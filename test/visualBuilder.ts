/// <reference path="_references.ts"/>

module powerbi.extensibility.visual.test {

    //  import VisualPlugin = powerbi.visuals.plugins.bubbleChartEEDCDFA388784AEEAB47972BC1626196_DEBUG;
    import VisualClass = powerbi.extensibility.visual.bubbleChartEEDCDFA388784AEEAB47972BC1626196.Visual;
    import DataPoint = powerbi.extensibility.visual.bubbleChartEEDCDFA388784AEEAB47972BC1626196.DataPoint;
    // powerbi.extensibility.utils.test
    import VisualBuilderBase = powerbi.extensibility.utils.test.VisualBuilderBase;

    export interface SelectionState {
        items: string;
        state: boolean;
    }

    export interface Rect {
        x: number;
        y: number;
        width: number;
        height: number;
    }

    export class BubbleChartBuilder extends VisualBuilderBase<VisualClass> {
        constructor(width: number, height: number) {
            super(width, height, "bubbleChartEEDCDFA388784AEEAB47972BC1626196");
        }

        public get instance(): VisualClass {
            return this.visual;
        }

        protected build(options: VisualConstructorOptions): VisualClass {
            return new VisualClass(options);
        }

        public getLegend(): JQuery {
            return this.element
                .children(".legend");
        }

        public get mainElement(): JQuery {
            return this.element.children("svg");
        }
        public get firstlayerNodes(): JQuery {
            return this.mainElement
                .children(".layer")
                .eq(0)
                .children(".node");
        }
        public get secondlayerNodes(): JQuery {
            return this.mainElement
                .children(".layer")
                .eq(1)
                .children(".node");
        }

        public getCategoryNodeById(id: string): HTMLElement {
            return this.secondlayerNodes.toArray().filter((el: HTMLElement) => {
                return $(el).find("circle").attr("id") === id;
            })[0];
        }

        public getGroupNodeById(id: string): HTMLElement {
            return this.firstlayerNodes.toArray().filter((el: HTMLElement) => {
                return $(el).find("circle").attr("id") === id;
            })[0];
        }

        public getLegendName(): string {
            return this.getLegend()
                .children("#legendGroup")
                .children(".legendTitle")
                .clone()
                .children()
                .remove()
                .end()
                .text();
        }

        public getLabelColors(): string[] {
            return this.secondlayerNodes.toArray()
                .map((el: Element) => {
                    return $(el).find("text").css("fill");
                });
        }

        public getLabelPropertybyCategoryIds(categoryIds: string[], labelProperty: string) {
            const colors: string[] = [];
            this.secondlayerNodes.filter((idx: number, el: Element) => {
                return categoryIds.indexOf($(el)
                    .children("circle")
                    .attr("id")) >= 0;
            }).each((idx: number, el: Element) => {
                colors.push($(el).children("text").css(labelProperty));
            });

            return colors;
        }

        public getLabelFontsizes(): string[] {
            return this.secondlayerNodes.toArray()
                .map((el: Element) => {
                    return $(el).find("text").css("font-size");
                });
        }

        public getLegendElementsFontsizes(): string[] {
            return this.getLegend().find("text").toArray()
                .map((el: Element) => {
                    return $(el).css("font-size");
                });
        }
    }
}