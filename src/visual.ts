module powerbi.extensibility.visual {
    "use strict";
    import tooltip = powerbi.extensibility.utils.tooltip;
    import TooltipEnabledDataPoint = powerbi.extensibility.utils.tooltip.TooltipEnabledDataPoint;
    import TooltipEventArgs = powerbi.extensibility.utils.tooltip.TooltipEventArgs;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
    import textMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;
    import ILegend = powerbi.extensibility.utils.chart.legend.ILegend;
    import createLegend = powerbi.extensibility.utils.chart.legend.createLegend;
    import LegendData = powerbi.extensibility.utils.chart.legend.LegendData;
    import LegendDataPoint = powerbi.extensibility.utils.chart.legend.LegendDataPoint;
    import LegendIcon = powerbi.extensibility.utils.chart.legend.LegendIcon;
    import LegendPosition = powerbi.extensibility.utils.chart.legend.LegendPosition;
    import createInteractivityService = powerbi.extensibility.utils.interactivity.createInteractivityService;
    import ColorHelper = powerbi.extensibility.utils.color.ColorHelper;
    import CssConstants = powerbi.extensibility.utils.svg.CssConstants;
    import validationHelper = powerbi.extensibility.utils.dataview.validationHelper;

    export interface DataPoint extends d3.layout.pack.Node {
        name?: string;
        highlighted?: boolean;
        selectionId?: visuals.ISelectionId;
        childSelectionId?: visuals.ISelectionId;
        fill?: string;
        tooltipInfo?: VisualTooltipDataItem[];
        children?: DataPoint[];
        imageUrl?: string;
        hyperlink?: string;
    }

    export interface Data {
        dataPoints: DataPoint[];
        imageDataPoints: DataPoint[];
        isHighlighted: boolean;
        isGrouped: boolean;
        settings: VisualSettings;
    }

    export class Visual implements IVisual {
        public host: IVisualHost;
        private svg: d3.Selection<DataPoint>;
        private defs: d3.Selection<DataPoint>;
        private defaultFontFamily: string = "sans-serif";

        public data: Data;

        private tooltipServiceWrapper: tooltip.ITooltipServiceWrapper;
        private selectionManager: ISelectionManager;
        private radiusOffset: number = -2; // used as padding for text label in bubble
        private defaultValue: number = 1;
        private horizontalPadding: number = 10;
        private verticalPadding: number = 10;

        private selectionIsRestored: boolean = false;
        private legend: ILegend;
        private root: d3.Selection<any>;

        private categoryColumnName: string;
        private groupingColumnName: string;
        private measureColumnName: string;

        private exitAnimDuration: number = 300;
        private enterAnimDuration: number = 300;
        private changingAnimDuration: number = 300;
        private circleRemovalDelay: number = 700;
        private opacityAnimDuration: number = 170;

        private nodeSelector: CssConstants.ClassAndSelector = CssConstants.createClassAndSelector("node");
        private layerSelector: CssConstants.ClassAndSelector = CssConstants.createClassAndSelector("layer");
        private circleSelector: CssConstants.ClassAndSelector = CssConstants.createClassAndSelector("circle");
        private textSelector: CssConstants.ClassAndSelector = CssConstants.createClassAndSelector("text");
        private legendSelector: CssConstants.ClassAndSelector = CssConstants.createClassAndSelector("legend");

        constructor(options: VisualConstructorOptions) {
            this.host = options.host;

            this.tooltipServiceWrapper = tooltip.createTooltipServiceWrapper(
                this.host.tooltipService,
                options.element);

            this.selectionManager = options.host.createSelectionManager();
            this.root = d3.select(options.element);
            d3.select(options.element.parentNode)
                .style("-webkit-tap-highlight-color", "rgba(0, 0, 0, 0)")
                .style("-webkit-user-select", "none")
                .style("-moz-user-select", "none")
                .style("-ms-user-select", "none")
                .style("user-select", "none");

            this.svg = this.root
                .append("svg")
                .classed("main-canvas", true)
                .on("click", () => {
                    const mouseEvent = d3.event as MouseEvent;

                    if (mouseEvent.target === this.svg[0][0] as EventTarget) {

                        if (!mouseEvent.ctrlKey) {
                            this.selectionManager.clear()
                                .then(() => {
                                    this.selectAllNodes();
                                });
                        }
                    }
                });
            this.defs = this.svg.append("defs");
        }

        private getKeyForDataPoint(d: DataPoint) {
            const parent: DataPoint = (d.parent as DataPoint);
            const parentNodeName = (parent && parent.name) ? parent.name : "";
            const imageUrl: string = (d.imageUrl) ? d.imageUrl : "";

            return JSON.stringify({
                parent: parentNodeName,
                name: d.name,
                image: imageUrl
            });
        }

        public convertStringToIdFormat(text: string): string {
            if (!isNaN(Number(text[0]))) {
                text = `a${text}`;
            }
            const textWithoutSpaces: string = text.split(" ").join("_");

            const res: string = textWithoutSpaces.replace(/([^A-Za-z0-9-:\._])/g,
                (match: string, p1) => {
                    return `-${p1.charCodeAt(0)}-`;
                });

            return res;
        }

        private getCategoryByDataRole(dataCategories: DataViewCategoryColumn[], dataRole: string): string[] {
            const categories: DataViewCategoryColumn[] = dataCategories
                .filter((c: DataViewCategoryColumn) => c.source.roles[dataRole]);

            if (categories.length >= 1) {
                return categories[0].values as string[];
            } else {
                return undefined;
            }
        }

        private validateImageUrls(imageDataPoints: DataPoint[], dataPoints: DataPoint[]): DataPoint[] {
            return dataPoints.map((d: DataPoint) => {
                if (imageDataPoints.indexOf(d) < 0) {
                    d.imageUrl = undefined;
                }

                return d;
            });
        }

        private updateImagesForDataPoints(dataPoints: DataPoint[]) {
            const pattern: d3.selection.Update<DataPoint> = this.defs.selectAll("pattern")
                .data<DataPoint>(dataPoints, (d: DataPoint) => d.name);

            const newPattern: d3.Selection<DataPoint> = pattern.enter().append("pattern");

            newPattern.append("image")
                .transition()
                .attr("height", "1")
                .attr("width", "1")
                .attr("preserveAspectRatio", "xMidYMid slice")
                .attr("xlink:href", (d: DataPoint) => d.imageUrl);

            pattern.transition()
                .attr("id", (d: DataPoint) => `${this.convertStringToIdFormat(d.name)}_image`)
                .attr("height", "100%")
                .attr("width", "100%")
                .attr("patternContentUnits", "objectBoundingBox");

            pattern.exit()
                .transition()
                .delay(this.circleRemovalDelay)
                .remove();
        }

        private getImageDataPoints(dataPoints: DataPoint[]): DataPoint[] {
            const imageDataPoints: DataPoint[] = [];

            dataPoints.forEach((d: DataPoint) => {
                if (d.children) {
                    imageDataPoints.push(...this.getImageDataPoints(d.children));
                }
                if (d.imageUrl && validationHelper.isImageUrlAllowed(d.imageUrl)) {
                    imageDataPoints.push(d);
                }
            });

            return imageDataPoints;
        }

        private scaleBubbles(dataPoints: DataPoint[][], viewport: IViewport): DataPoint[][] {
            let yMin = Infinity;
            let yMax = -Infinity;
            let xMin = Infinity;
            let xMax = -Infinity;

            dataPoints[0].forEach((d: DataPoint) => {
                const curLeftX: number = d.x - d.r;
                const curRightX: number = d.x + d.r;
                const curTopY: number = d.y - d.r;
                const curBottomY: number = d.y + d.r;

                if (curLeftX < xMin) {
                    xMin = curLeftX;
                }
                if (curRightX > xMax) {
                    xMax = curRightX;
                }
                if (curTopY < yMin) {
                    yMin = curTopY;
                }
                if (curBottomY > yMax) {
                    yMax = curBottomY;
                }
            });
            const curWidth: number = xMax - xMin;
            const curHeight: number = yMax - yMin;
            const horizontalMargin: number = viewport.width - curWidth - this.horizontalPadding;
            const verticalMargin: number = viewport.height - curHeight - this.verticalPadding;

            const horizontalScaleFactor: number = (horizontalMargin + curWidth) / curWidth;
            const verticalScaleFactor: number = (verticalMargin + curHeight) / curHeight;

            let scaleFactor: number = (verticalScaleFactor < horizontalScaleFactor)
                ? verticalScaleFactor
                : horizontalScaleFactor;

            return dataPoints.map((layer: DataPoint[]) => {
                return layer.map((d: DataPoint) => {

                    return this.scaleDataPoint(d, scaleFactor, viewport);
                });
            });
        }

        private scaleDataPoint(d: DataPoint,
            scaleFactor: number,
            viewport: IViewport): DataPoint {
            const midX: number = viewport.width / 2;
            const midY: number = viewport.height / 2;

            d.x = midX + scaleFactor * (d.x - midX);
            d.y = midY + scaleFactor * (d.y - midY);
            d.r *= scaleFactor;

            return d;
        }

        private selectAllNodes(ids?: ISelectionId[]) {
            if (ids !== undefined) {
                this.svg.selectAll(this.nodeSelector.selectorName)
                    .transition()
                    .duration(this.opacityAnimDuration)
                    .ease("linear")
                    .style("opacity",
                    (d: DataPoint) => this.getOpacityForSelection(d, ids));
            } else {
                this.svg.selectAll(this.nodeSelector.selectorName)
                    .transition()
                    .duration(this.opacityAnimDuration)
                    .ease("linear")
                    .style("opacity", this.getOpacity(true));
            }
        }

        private getCategoricalObjectValue<T>(
            category: DataViewCategoryColumn,
            index: number,
            objectName: string,
            propertyName: string,
            defaultValue: T
        ): T {
            const categoryObjects: DataViewObjects[] = category.objects;

            if (categoryObjects) {
                const categoryObject: DataViewObject = categoryObjects[index];

                if (categoryObject) {
                    const object: DataViewPropertyValue = categoryObject[objectName];

                    if (object) {

                        const property: T = <T>object[propertyName];
                        if (property !== undefined) {

                            return property;
                        }
                    }
                }
            }

            return defaultValue;
        }

        private getGroupObjectValue<T>(
            group: DataViewValueColumnGroup,
            objectName: string,
            propertyName: string,
            defaultValue: T
        ): T {
            const categoryObject: DataViewObject = group.objects;

            if (categoryObject) {
                const object: DataViewPropertyValue = categoryObject[objectName];

                if (object) {
                    const property: T = <T>object[propertyName];
                    if (property !== undefined) {

                        return property;
                    }
                }
            }

            return defaultValue;
        }

        private getBubbleColor(bubbleName: string): string {
            return this.host.colorPalette.getColor(bubbleName).value;
        }

        private getCategories(dataView: DataView): DataViewCategoryColumn[] {
            return (dataView.categorical
                && dataView.categorical.categories
                || []);
        }

        private getValuesFromDataViews(dataView: DataView): PrimitiveValue[] {
            return (dataView
                && dataView.categorical
                && dataView.categorical.values
                && dataView.categorical.values[0]
                && dataView.categorical.values[0].values
                || []);
        }

        private getGroupsFromDataViews(dataView: DataView): DataViewValueColumnGroup[] {
            return (dataView
                && dataView.categorical
                && dataView.categorical.values
                && dataView.categorical.values.grouped()
                || []) as DataViewValueColumnGroup[];
        }

        private getValueForGroup(group: DataViewValueColumnGroup): number {

            return group.values[0].values
                .reduce((a: number, b: number) => {
                    const filteredA: number = this.getFilteredValue(a);
                    const filteredB: number = this.getFilteredValue(b);
                    return filteredA + filteredB;
                }) as number;
        }

        private getHighlights(dataView: DataView): PrimitiveValue[] {
            return (dataView
                && dataView.categorical
                && dataView.categorical.values
                && dataView.categorical.values[0]
                && dataView.categorical.values[0].highlights
                || []);
        }

        public getGroupHighlights(dataView: DataView): PrimitiveValue[][] {
            return (dataView
                && dataView.categorical
                && dataView.categorical.values
                && dataView.categorical.values
                    .map((value: DataViewValueColumn) => {
                        return value.highlights;
                    })
                || []);
        }

        private getTextProperties(text: string): TextProperties {
            return {
                text,
                fontFamily: this.defaultFontFamily,
                fontSize: this.data.settings.labelSettings.fontSizeInPx,
                fontStyle: this.data.settings.labelSettings.italicAsString,
                fontWeight: this.data.settings.labelSettings.boldAsString,
                whiteSpace: "nowrap",
                fontVariant: "normal",
            };
        }

        public getTextForBubble(text: string, radius: number): string {
            const textProperties: TextProperties = this.getTextProperties(text);
            if (text === null) {
                return "";
            } else {
                return textMeasurementService.getTailoredTextOrDefault(textProperties, 2 * radius);
            }
        }

        public getOpacityForSelection(d: DataPoint, ids: ISelectionId[]): number {
            const isHighlighted: boolean = ids.some((id: visuals.ISelectionId) => {
                return d.selectionId.equals(id);
            });

            return this.getOpacity(isHighlighted);
        }

        public getOpacityForHighlighting(d: DataPoint): number {

            return this.getOpacity(d.highlighted);
        }

        private getOpacity(isHighlighted: boolean): number {
            return isHighlighted ? 1 : 0.35;
        }

        private getMarginForCanvas(legendMargins: IViewport,
            legendOrientation: LegendPosition): string {
            switch (legendOrientation) {
                case LegendPosition.Top:
                case LegendPosition.TopCenter:
                    {
                        return `${legendMargins.height}px 0 0 0`;
                    }
                case LegendPosition.Left:
                case LegendPosition.LeftCenter:
                    {
                        return `0 0 0 ${legendMargins.width}px`;
                    }
                default:
                    {
                        return null;
                    }
            }
        }

        private convertData(options: VisualUpdateOptions): Data {
            const dataView: DataView = options.dataViews[0];
            const categories: DataViewCategoryColumn[] = this.getCategories(dataView);
            const category: DataViewCategoryColumn = categories[0];

            const names: string[] = this.getCategoryByDataRole(categories, "category");
            const values: number[] = this.getValuesFromDataViews(dataView) as number[];

            const imageUrls: string[] = this.getCategoryByDataRole(categories, "image");
            const categoricalValues: DataViewValueColumns = dataView.categorical.values;
            const hyperlinks: string[] = this.getCategoryByDataRole(categories, "hyperlink");

            let dataPoints: DataPoint[] = [];
            const flatDataPoints: DataPoint[] = [];
            const groups: DataViewValueColumnGroup[] = this.getGroupsFromDataViews(options.dataViews[0]);
            let isHighlighted: boolean;
            let isGrouped: boolean;
            let categoryShiftIdx: number = 0;

            if (groups.length <= 1) {
                isGrouped = false;

                const highlights: number[] = this.getHighlights(options.dataViews[0]) as number[];

                isHighlighted = !!highlights.length;
                dataPoints = this.getCategoryDataPoints(category, values, names, highlights, categoricalValues, imageUrls, hyperlinks);
            } else {
                isGrouped = true;

                const groupHighlights: number[][]
                    = this.getGroupHighlights(options.dataViews[0]) as number[][];
                isHighlighted = groupHighlights.some((highlights) => highlights !== undefined);

                dataPoints = groups.map((group: DataViewValueColumnGroup, idx: number) => {
                    const groupDataPoint: DataPoint = this.getGroupDataPoint(
                        category,
                        group,
                        categoricalValues,
                        names,
                        groupHighlights[idx] || [],
                        imageUrls,
                        hyperlinks
                    );

                    categoryShiftIdx += groupDataPoint.children.length;

                    return groupDataPoint;
                });
            }

            const settings: VisualSettings = this.parseSettings(options.dataViews[0]);

            const imageDataPoints: DataPoint[] = this.getImageDataPoints(dataPoints);

            dataPoints = this.validateImageUrls(imageDataPoints, dataPoints);

            return { dataPoints, isHighlighted, isGrouped, settings, imageDataPoints };
        }

        private getFilteredValue(value: number): number {
            let resValue: number = (value !== undefined)
                ? value
                : this.defaultValue;

            if (resValue <= 0
                || resValue === null
                || isNaN(resValue)
                || Math.abs(resValue) === Infinity
            ) {
                return null;
            } else {
                return resValue;
            }
        }

        private getCategoryDataPoints(
            category: DataViewCategoryColumn,
            values: number[],
            names: string[],
            highlights: number[],
            categoricalValues?: DataViewValueColumns,
            imageUrls?: string[],
            hyperlinks?: string[],
            group?: DataViewValueColumnGroup,
            parentDataPoint?: DataPoint
        ): DataPoint[] {
            const dataPoints: DataPoint[] = [];

            names.forEach((name: string, idx: number) => {

                const numericValue: number = this.getFilteredValue(values[idx]);

                if (numericValue === null) {
                    return;
                }
                if (!name) {
                    return;
                }

                const value: string = `${numericValue}`;
                let imageUrl: string = (imageUrls) ? imageUrls[idx] : "";
                let hyperlink: string = (hyperlinks) ? hyperlinks[idx] : "";
                let selectionId: visuals.ISelectionId;
                let tooltipInfo: VisualTooltipDataItem[] = [];

                let childSelectionId: visuals.ISelectionId = this.host.createSelectionIdBuilder()
                    .withCategory(category, idx)
                    .createSelectionId();

                if (categoricalValues !== undefined
                    && group !== undefined) {
                    selectionId = this.host.createSelectionIdBuilder()
                        .withCategory(category, idx)
                        .withSeries(categoricalValues, group)
                        .createSelectionId();

                    tooltipInfo = [
                        {
                            displayName: this.groupingColumnName,
                            value: group.name
                        },
                        {
                            displayName: this.categoryColumnName,
                            value: name
                        },
                        {
                            displayName: this.measureColumnName,
                            value
                        }
                    ] as VisualTooltipDataItem[];
                } else if (this.measureColumnName !== undefined) {
                    selectionId = childSelectionId;

                    tooltipInfo = [
                        {
                            displayName: this.categoryColumnName,
                            value: name
                        },
                        {
                            displayName: this.measureColumnName,
                            value
                        }
                    ] as VisualTooltipDataItem[];
                } else {
                    selectionId = childSelectionId;
                    tooltipInfo = [
                        {
                            displayName: this.categoryColumnName,
                            value: name
                        }
                    ] as VisualTooltipDataItem[];
                }

                const fill: string = this.getCategoricalObjectValue<Fill>(
                    category,
                    idx,
                    "dataPointColor",
                    "fill",
                    { solid: { color: this.getBubbleColor(name) } }
                ).solid.color;

                let dataPoint = {
                    highlighted: highlights[idx] !== null,
                    name,
                    value: numericValue,
                    fill,
                    selectionId,
                    childSelectionId,
                    tooltipInfo,
                    imageUrl,
                    hyperlink,
                    parent: parentDataPoint
                } as DataPoint;

                dataPoints.push(dataPoint);
            });

            return dataPoints;
        }

        private getGroupDataPoint(
            category: DataViewCategoryColumn,
            group: DataViewValueColumnGroup,
            categoricalValues: DataViewValueColumns,
            names: string[],
            highlights: number[],
            imageUrls?: string[],
            hyperlinks?: string[],
        ): DataPoint {
            const selectionId: visuals.ISelectionId = this.host.createSelectionIdBuilder()
                .withSeries(categoricalValues, group)
                .createSelectionId();

            const fill: string = this.getGroupObjectValue<Fill>(
                group,
                "dataGroupPointColor",
                "fill",
                { solid: { color: this.getBubbleColor(group.name as string) } }
            ).solid.color;

            const groupValue: number = this.getValueForGroup(group);

            let dataPoint: DataPoint = {
                name: group.name,
                value: groupValue,
                fill,
                selectionId,
                tooltipInfo: [{
                    displayName: this.groupingColumnName,
                    value: group.name
                },
                {
                    displayName: this.measureColumnName,
                    value: `${groupValue}`
                },
                ],
            } as DataPoint;

            dataPoint.children = this.getCategoryDataPoints(
                category,
                group.values[0].values as number[],
                names,
                highlights,
                categoricalValues,
                imageUrls,
                hyperlinks,
                group,
                dataPoint);

            dataPoint.highlighted = dataPoint.children.every((d: DataPoint) => d.highlighted);

            return dataPoint;
        }

        private getDataByLayers(dataPoints: DataPoint[]): DataPoint[][] {
            const resDataPoints: DataPoint[][] = [];

            dataPoints.forEach((dataPoint: DataPoint) => {
                const depth: number = dataPoint.depth - 1;

                if (resDataPoints[depth] === undefined) {
                    resDataPoints[depth] = [];
                }

                resDataPoints[depth].push(dataPoint);
            });

            return resDataPoints;
        }

        private renderLegend(data: Data, viewport: IViewport): IViewport {

            if (!data
                || !data.isGrouped
                || !data.settings.legendSettings.show
            ) {

                this.root.selectAll(this.legendSelector.selectorName).remove();
                this.legend = null;

                return { width: 0, height: 0 };
            } else if (!this.legend) {

                this.legend = createLegend(
                    this.root.node() as HTMLDivElement,
                    false,
                    null,
                    true);
            }

            const legendDataPoints: LegendDataPoint[]
                = data.dataPoints.map((d: DataPoint) => {
                    return {
                        label: d.name,
                        identity: d.selectionId,
                        tooltip: d.name,
                        color: d.fill,
                        icon: LegendIcon.Circle,
                        measure: ""
                    } as LegendDataPoint;
                });

            const legendData: LegendData = {
                title: data.settings.legendSettings.name,
                grouped: true,
                dataPoints: legendDataPoints,
                fontSize: data.settings.legendSettings.fontSize,
            };

            this.legend.changeOrientation(data.settings.legendSettings.position);
            this.legend.drawLegend(legendData, viewport);

            return this.legend.getMargins();
        }

        private setTextForTextElement(
            textElement: d3.Selection<DataPoint>,
            labelSettings: LabelSettings): d3.Selection<DataPoint> {
            return textElement.text((d: DataPoint) => {
                if (d.children !== undefined || !labelSettings.show) {
                    return "";
                } else {
                    return this.getTextForBubble(d.name, d.r + this.radiusOffset);
                }
            });
        }

        private setStyleForTextElement(
            textElement: d3.Transition<DataPoint> | d3.Selection<DataPoint>,
            labelSettings: LabelSettings): d3.Transition<DataPoint> | d3.Selection<DataPoint> {
            const {
                boldAsString,
                italicAsString,
                fontSizeInPx,
                underlineAsString,
                hyperlinkUnderlineAsString,
                hyperlinkFill,
                hyperlinkUnderline,
                fill,
            } = labelSettings;

            return textElement.style(
                {
                    "font-size": fontSizeInPx,
                    "font-weight": boldAsString,
                    "font-style": italicAsString,
                    "text-decoration": underlineAsString,
                    "visibility": "visible"
                })
                .style("fill", (d: DataPoint) => {

                    if (!d.hyperlink) {
                        return fill;
                    } else {
                        return (hyperlinkFill !== undefined) ? hyperlinkFill : fill;
                    }
                })
                .style("text-decoration", (d: DataPoint) => {
                    if (!d.hyperlink) {
                        return underlineAsString;
                    } else {
                        return (hyperlinkUnderline !== undefined) ? hyperlinkUnderlineAsString : underlineAsString;
                    }
                });
        }

        private setStyleForCircleElement(
            circleElement: d3.Selection<DataPoint>): d3.Selection<DataPoint> {
            return circleElement.style("fill", (d: DataPoint) => {
                if (d.imageUrl) {
                    return `url(#${this.convertStringToIdFormat(d.name)}_image)`;
                } else {
                    return d.fill;
                }
            });
        }

        private createGroup(updateGroup: d3.selection.Update<DataPoint>, data: Data) {
            const enterGroup: d3.selection.Enter<DataPoint> = updateGroup.enter()
                .append("g")
                .classed(this.nodeSelector.className, true)
                .attr("transform", (d: DataPoint) => { return `translate(${d.x},${d.y})`; })
                .on("click", (d: DataPoint) => {
                    const mouseEvent: MouseEvent = d3.event as MouseEvent;
                    const dataPointsForSel: DataPoint[]
                        = (d.children !== undefined)
                            ? [d].concat(d.children)
                            : [d];

                    dataPointsForSel.forEach((selD, idx: number) => {
                        this.selectionManager.select(selD.selectionId,
                            mouseEvent.ctrlKey || idx > 0)
                            .then((ids: ISelectionId[]) => {
                                if (ids.length !== 0) {

                                    this.selectAllNodes(ids);
                                } else {

                                    this.selectAllNodes();
                                }
                            });
                    });
                });

            this.createCircle(enterGroup);

            this.createText(enterGroup, data);
        }

        private createCircle(group: d3.selection.Enter<DataPoint>): d3.Transition<DataPoint> {
            const newCircle: d3.Selection<DataPoint> = group.append(this.circleSelector.className)
                .attr("id", (d: DataPoint) => this.convertStringToIdFormat(d.name));

            const styledNewCircle: d3.Selection<DataPoint> = this.setStyleForCircleElement(newCircle);

            return styledNewCircle
                .attr("r", 0)
                .transition()
                .duration(this.enterAnimDuration)
                .ease("linear")
                .attr("r", (d) => d.r);
        }

        private createText(group: d3.selection.Enter<DataPoint>,
            data: Data): d3.Selection<DataPoint> {
            const newText: d3.Selection<DataPoint> = group.append(this.textSelector.className);

            const newTextWithValue: d3.Selection<DataPoint> =
                this.setTextForTextElement(newText, this.data.settings.labelSettings);

            const styledNewText: d3.Selection<DataPoint> | d3.Transition<DataPoint> =
                this.setStyleForTextElement(newTextWithValue, data.settings.labelSettings);

            styledNewText.attr("dy", "0.25em")
                .style("opacity", 0)
                .transition()
                .duration(this.changingAnimDuration)
                .ease("exp")
                .style("opacity", 1);

            return newText.on("click", (d: DataPoint) => {
                if (d.hyperlink) {
                    (d3.event as Event).stopPropagation();
                    this.host.launchUrl(d.hyperlink);
                }
            });
        }

        private createLayer(layer: d3.selection.Update<DataPoint[]>): d3.Selection<DataPoint[]> {
            return layer.enter().append("g")
                .classed(this.layerSelector.className, true);
        }

        private renderGroup(group: d3.selection.Update<DataPoint>,
            data: Data) {

            const circle: d3.selection.Update<DataPoint> = group.selectAll(this.circleSelector.className)
                .data((dataPoints: DataPoint) => [dataPoints]);

            const text: d3.selection.Update<DataPoint> = group.selectAll(this.textSelector.className)
                .data((dataPoints: DataPoint) => [dataPoints]);

            group.style("opacity",
                (d: DataPoint) => {
                    if (data.isHighlighted) {
                        return this.getOpacityForHighlighting(d);

                    } else if (this.selectionManager.hasSelection()) {
                        const selectionIds: ISelectionId[] = this.selectionManager.getSelectionIds();

                        return this.getOpacityForSelection(d, selectionIds);

                    } else {
                        return this.getOpacity(true);
                    }
                });

            group.transition()
                .duration(this.changingAnimDuration)
                .ease("linear")
                .attr("transform", (d: DataPoint) => { return `translate(${d.x},${d.y})`; });

            this.renderCircle(circle);
            this.renderText(text, data);
        }

        private renderCircle(circle: d3.selection.Update<DataPoint>) {
            const styledExistingCircle: d3.Selection<DataPoint> =
                this.setStyleForCircleElement(circle);

            styledExistingCircle.transition()
                .duration(this.changingAnimDuration)
                .ease("linear")
                .attr("r", (d: DataPoint) => d.r);
        }

        private renderText(updateText: d3.selection.Update<DataPoint>,
            data: Data) {
            const existingTextWithValue: d3.Selection<DataPoint> =
                this.setTextForTextElement(updateText, this.data.settings.labelSettings)
                    .attr("dy", "0.25em");

            const existingTextTransition: d3.Transition<DataPoint> = existingTextWithValue.transition()
                .style("opacity", 1);

            this.setStyleForTextElement(existingTextTransition, data.settings.labelSettings);

            existingTextWithValue.on("click", (d: DataPoint) => {
                if (d.hyperlink) {
                    (d3.event as Event).stopPropagation();
                    this.host.launchUrl(d.hyperlink);
                }
            });
        }

        private exitGroup(group: d3.selection.Update<DataPoint>) {
            const exitGroup: d3.Selection<DataPoint> = group.exit();

            exitGroup.transition()
                .delay(this.exitAnimDuration)
                .remove();
            const circle: d3.Selection<DataPoint> =
                exitGroup.selectAll(this.circleSelector.className);

            const text: d3.Selection<DataPoint> =
                exitGroup.selectAll(this.textSelector.className);

            this.exitCircle(circle);
            this.exitText(text);
        }

        private exitCircle(circle: d3.Selection<DataPoint>) {
            circle.transition()
                .duration(this.exitAnimDuration)
                .ease("linear")
                .attr("r", 0)
                .transition()
                .delay(this.circleRemovalDelay)
                .remove();
        }

        private exitText(text: d3.Selection<DataPoint>) {
            text.style("visibility", "hidden")
                .transition()
                .delay(this.exitAnimDuration)
                .remove();
        }

        private exitLayer(layer: d3.selection.Update<DataPoint[]>) {
            layer.exit().remove();
        }

        private render(
            data: Data,
            viewport: IViewport,
            legendMargins: IViewport,
            legendOrientation: LegendPosition) {

            this.updateImagesForDataPoints(this.data.imageDataPoints);

            viewport.height -= legendMargins.height;
            viewport.width -= legendMargins.width;
            const margin: string = (legendOrientation !== null)
                ? this.getMarginForCanvas(legendMargins, legendOrientation)
                : null;

            this.svg.style({
                width: `${viewport.width}px`,
                height: `${viewport.height}px`,
                margin
            });

            const pack: d3.layout.Pack<DataPoint> = d3.layout.pack()
                .sort(null)
                .size([viewport.width, viewport.height])
                .padding(data.settings.commonSettings.padding) as d3.layout.Pack<DataPoint>;

            const hyperlinkFill: string = data.settings.labelSettings.hyperlinkFill;
            const hyperlinkUnderline: boolean = data.settings.labelSettings.hyperlinkUnderline;

            let dataByLayers: DataPoint[][] = this.getDataByLayers(pack({ children: data.dataPoints }).splice(1));
            dataByLayers = this.scaleBubbles(dataByLayers, viewport);

            const layerElement: d3.selection.Update<DataPoint[]> = this.svg.selectAll(this.layerSelector.selectorName)
                .data<DataPoint[]>(dataByLayers, (d: DataPoint[], idx: number) => idx.toString());

            this.createLayer(layerElement);
            this.exitLayer(layerElement);

            const node: d3.selection.Update<DataPoint> = layerElement.selectAll(this.nodeSelector.selectorName)
                .data<DataPoint>((dataPoints: DataPoint[]) => dataPoints, (d: DataPoint) => this.getKeyForDataPoint(d));

            this.renderGroup(node, data);

            this.createGroup(node, data);

            this.tooltipServiceWrapper.addTooltip<TooltipEnabledDataPoint>(node,
                (eventArgs: TooltipEventArgs<TooltipEnabledDataPoint>) => {
                    return eventArgs.data.tooltipInfo;
                });

            const nodeExit: d3.Selection<DataPoint> = node.exit();

            this.exitGroup(node);
        }

        public update(options: VisualUpdateOptions) {
            if (!options) {
                return;
            }

            this.getColumnNames(options.dataViews[0]);

            this.data = this.convertData(options);

            const legendMargins: IViewport = this.renderLegend(this.data, options.viewport);

            this.render(
                this.data,
                options.viewport,
                legendMargins,
                (this.legend) ? this.legend.getOrientation() : null);
        }

        private getColumnNames(dataView: DataView) {
            let groupingWasFound: boolean = false;
            let measureWasFound: boolean = false;

            dataView.metadata.columns
                .forEach((c: DataViewMetadataColumn) => {

                    if (c.roles["category"]) {
                        this.categoryColumnName = c.displayName;
                    }

                    if (c.roles["grouping"]) {
                        this.groupingColumnName = c.displayName;
                        groupingWasFound = true;
                    }

                    if (c.roles["measure"]) {
                        this.measureColumnName = c.displayName;
                        measureWasFound = true;
                    }
                });

            if (!groupingWasFound) {
                this.groupingColumnName = undefined;
            }

            if (!measureWasFound) {
                this.measureColumnName = undefined;
            }
        }

        private parseSettings(dataView: DataView): VisualSettings {
            const settings: VisualSettings = (VisualSettings.parse(dataView)) as VisualSettings;

            settings.commonSettings.parse();

            if (!settings.legendSettings.name) {
                settings.legendSettings.name = this.groupingColumnName;
            }

            return settings;
        }

        public enumerateDataPoint(objectName: string): VisualObjectInstance[] {
            if (!this.data) {
                return [];
            }

            if (this.data.isGrouped) {

                const childrenMap: { [propertyName: string]: boolean } = {};
                const childrenVisualObjInstances: VisualObjectInstance[] = [];

                this.data.dataPoints.forEach((dataPoint: DataPoint) => {
                    if (!dataPoint.children) {
                        return;
                    }

                    dataPoint.children.forEach((childDataPoint: DataPoint) => {
                        if (childrenMap[childDataPoint.name] === undefined) {
                            childrenVisualObjInstances.push({
                                objectName,
                                displayName: `${childDataPoint.name}`,
                                selector: childDataPoint.childSelectionId.getSelector(),
                                properties: { fill: { solid: { color: childDataPoint.fill } } }
                            } as VisualObjectInstance);
                            childrenMap[childDataPoint.name] = true;
                        }
                    });
                });

                return childrenVisualObjInstances;
            } else {

                return this.data.dataPoints.map((dataPoint: DataPoint) => {
                    return {
                        objectName,
                        displayName: dataPoint.name,
                        selector: dataPoint.childSelectionId.getSelector(),
                        properties: { fill: { solid: { color: dataPoint.fill } } }
                    } as VisualObjectInstance;
                });
            }
        }

        public enumerateGroupDataPoint(objectName: string): VisualObjectInstance[] {
            if (!this.data || !this.data.isGrouped) {
                return [];
            }

            return this.data.dataPoints.map((dataPoint: DataPoint) => {
                return {
                    objectName,
                    displayName: dataPoint.name,
                    selector: dataPoint.selectionId.getSelector(),
                    properties: { fill: { solid: { color: dataPoint.fill } } }
                } as VisualObjectInstance;
            });
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions)
            : VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            switch (options.objectName) {
                case "dataPointColor": {
                    return this.enumerateDataPoint(options.objectName);
                }
                case "dataGroupPointColor": {
                    return this.enumerateGroupDataPoint(options.objectName);
                }
                default: {
                    return VisualSettings.enumerateObjectInstances(
                        this.data.settings || VisualSettings.getDefault(),
                        options);
                }
            }
        }
    }
}