/// <reference path="_references.ts"/>

module powerbi.extensibility.visual.test {
    import BubbleChartData = powerbi.extensibility.visual.test.BubbleChartData;
    import BubbleChartBuilder = powerbi.extensibility.visual.test.BubbleChartBuilder;
    import getSolidColorStructuralObject = powerbi.extensibility.utils.test.helpers.color.getSolidColorStructuralObject;
    import VisualClass = powerbi.extensibility.visual.bubbleChartEEDCDFA388784AEEAB47972BC1626196.Visual;
    import DataPoint = powerbi.extensibility.visual.bubbleChartEEDCDFA388784AEEAB47972BC1626196.DataPoint;
    import assertColorsMatch = powerbi.extensibility.utils.test.helpers.color.assertColorsMatch;
    import MockISelectionId = powerbi.extensibility.utils.test.mocks.MockISelectionId;

    describe("BubbleChart", () => {
        let visualBuilder: BubbleChartBuilder,
            defaultDataViewBuilder: BubbleChartData,
            dataView: DataView;

        let padding: number = 10;

        function checkCategoriesCount() {
            const categoriesCount: number = dataView.categorical.categories[0].values.length;
            expect(visualBuilder.firstlayerNodes.length).toEqual(categoriesCount);
        }

        beforeAll(() => {
            let selectionIdx: number = 0;
            MockISelectionId.prototype.getKey = function () {
                return (selectionIdx++).toString();
            };
        });

        beforeEach(() => {
            visualBuilder = new BubbleChartBuilder(1000, 500);
            defaultDataViewBuilder = new BubbleChartData();

            dataView = defaultDataViewBuilder.getDataView([
                BubbleChartData.ColumnCategory,
                BubbleChartData.ColumnValue,
                BubbleChartData.ColumnGroup,
            ]);
        });

        describe("DOM tests", () => {
            it("svg element should be created", () => {
                expect(visualBuilder.mainElement[0]).toBeInDOM();
            });

            it("count of bubbles should be equal to categories count when only categories are set", (done) => {
                dataView = new BubbleChartData().getDataView([
                    BubbleChartData.ColumnCategory
                ]);

                visualBuilder.updateRenderTimeout(dataView, () => {
                    checkCategoriesCount();

                    done();
                }, 500);
            });

            it("render empty categories", (done) => {
                dataView = new BubbleChartData().getDataView([
                    BubbleChartData.ColumnCategory
                ]);

                visualBuilder.updateRenderTimeout(dataView, () => {
                    dataView.categorical.categories[0].values = [];
                    visualBuilder.updateRenderTimeout(dataView, () => {
                        checkCategoriesCount();
                        done();
                    }, 500);
                }, 500);
            });

            it("count of bubbles should be equal to categories count when categories and values are set", (done) => {
                dataView = new BubbleChartData().getDataView([
                    BubbleChartData.ColumnCategory,
                    BubbleChartData.ColumnValue
                ]);

                visualBuilder.updateRenderTimeout(dataView, () => {
                    checkCategoriesCount();

                    done();
                }, 500);
            });

            it("count of bubbles should be equal to categories and groups count when categories, groups and values are set", (done) => {
                dataView = new BubbleChartData().getDataView([
                    BubbleChartData.ColumnCategory,
                    BubbleChartData.ColumnGroup,
                    BubbleChartData.ColumnValue,
                ]);

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const categoriesCount: number = dataView.categorical.categories[0].values.length;
                    const groupsCount: number = dataView.categorical.values.grouped().length;

                    expect(visualBuilder.secondlayerNodes.length).toEqual(categoriesCount);
                    expect(visualBuilder.firstlayerNodes.length).toEqual(groupsCount);

                    done();
                }, 500);

            });

            it("bubble labels should be equal to category names", (done) => {
                dataView = new BubbleChartData().getDataView([
                    BubbleChartData.ColumnCategory,
                    BubbleChartData.ColumnValue,
                    BubbleChartData.ColumnGroup,
                ]);

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const categoryLabels: string[] = visualBuilder.secondlayerNodes.toArray().map((el: Element) => {
                        return $(el).children("text")[0].textContent;
                    });
                    const categoryNames: string[] = dataView.categorical.categories[0].values as string[];

                    expect(categoryLabels.every((label: string) => {
                        return categoryNames.indexOf(label) >= 0;
                    })).toEqual(true);

                    done();
                }, 500);
            });

            it("getTextForBubble should return empty string if text argument is null", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    const visualInstance: VisualClass = visualBuilder.instance;

                    expect(visualInstance.getTextForBubble(null, 10)).toEqual("");

                    done();
                }, 500);
            });
        });

        describe("Formatting panel options", () => {
            it("color of category bubble should be changed after changing bubble color in settings", (done) => {
                const categoryObjects: any = new Array(dataView.categorical.categories[0].values.length);

                // Set the color for Shanghai item
                categoryObjects[2] = {
                    dataPointColor: {
                        fill: getSolidColorStructuralObject("#00FF01")
                    }
                };
                dataView.categorical.categories[0].objects = categoryObjects;

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const elementColor: string = $(visualBuilder.getCategoryNodeById("Shanghai"))
                        .find("circle")
                        .css("fill");

                    assertColorsMatch(elementColor, "rgb(0, 255, 1)");

                    done();
                }, 500);
            });

            it("color of cluster bubble should be changed after changing bubble color in settings", (done) => {
                // Set the color for China group
                dataView.categorical.values.grouped()[2].objects = {
                    dataGroupPointColor: {
                        fill: getSolidColorStructuralObject("#00FF01")
                    }
                };

                visualBuilder.updateRenderTimeout(dataView, () => {

                    const elementColor = $(visualBuilder.getGroupNodeById("China"))
                        .find("circle")
                        .css("fill");

                    assertColorsMatch(elementColor, "rgb(0, 255, 1)");

                    done();
                }, 500);

            });

            it("legend name should be changed after changing it in settings", (done) => {
                dataView.metadata.objects = {
                    legendSettings: {
                        name: "Custom group name",
                    }
                };

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const legendName: string = visualBuilder.getLegendName();

                    expect(legendName).toEqual("Custom group name");

                    done();
                }, 500);
            });

            it("legend name should be equal to cluster name if it's not set in settings", (done) => {
                const groupFieldName: string = BubbleChartData.ColumnGroup;

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const legendName: string = visualBuilder.getLegendName();

                    expect(legendName).toEqual(groupFieldName);

                    done();
                }, 500);
            });

            it("color of all labels should be changed after changing this color in settings", (done) => {
                dataView.metadata.objects = {
                    labelSettings: {
                        fill: getSolidColorStructuralObject("#00FF01")
                    }
                };

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const labelColors: string[] = visualBuilder.getLabelColors();
                    labelColors.forEach((labelColor: string) => {

                        assertColorsMatch(labelColor, "rgb(0, 255, 1)");
                    });

                    done();
                }, 500);
            });

            it("fontsize of all labels should be changed after changing it in settings", (done) => {
                dataView.metadata.objects = {
                    labelSettings: {
                        fontSize: 15
                    }
                };

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const labelFontsizes: string[] = visualBuilder.getLabelFontsizes();
                    labelFontsizes.forEach((labelFontsize: string) => {
                        expect(labelFontsize).toEqual("15px");
                    });

                    done();
                }, 500);
            });

            it("legend fontsize should be changed after changing it in settings", (done) => {
                dataView.metadata.objects = {
                    legendSettings: {
                        fontSize: 15
                    }
                };

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const legendFontsizes: string[] = visualBuilder.getLegendElementsFontsizes();

                    legendFontsizes.forEach((legendFontsize: string) => {
                        expect(legendFontsize).toEqual("20px");
                    });

                    done();
                }, 500);
            });
        });

        describe("Unit tests for methods", () => {
            it("update method shouldn't throw exception if options are null", (done) => {
                const visual = visualBuilder.instance;
                visualBuilder.updateRenderTimeout(dataView, () => {
                    expect(() => {
                        visual.update(null);
                    }).not.toThrow();

                    done();
                }, 500);
            });

            it("enumerateDataPoint method should return count of items which is equal to category items count", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {

                    const enumerateRes: VisualObjectInstance[] =
                        visualBuilder.instance.enumerateDataPoint("dataPointColor");

                    expect(enumerateRes.length).toEqual(dataView.categorical.categories[0].values.length);

                    done();
                }, 500);
            });

            it("enumerateGroupDataPoint method should return count of items which is equal to clusters count", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    const enumerateRes: VisualObjectInstance[] =
                        visualBuilder.instance.enumerateGroupDataPoint("dataGroupPointColor");

                    expect(enumerateRes.length).toEqual(dataView.categorical.values.grouped().length);

                    done();
                }, 500);
            });

            it("enumerateGroupDataPoint should return empty array if data in visual is null", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    visualBuilder.instance.data = null;
                    const enumerateRes: VisualObjectInstance[] =
                        visualBuilder.instance.enumerateGroupDataPoint("dataGroupPointColor");

                    expect(enumerateRes).toEqual([]);

                    done();
                }, 500);
            });

            it("enumerateDataPoint should return empty array if data in visual is null", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    visualBuilder.instance.data = null;
                    const enumerateRes: VisualObjectInstance[] =
                        visualBuilder.instance.enumerateDataPoint("dataPointColor");

                    expect(enumerateRes).toEqual([]);

                    done();
                }, 500);
            });

            it("enumerateDataPoint should return count of items which is equal to category items count", (done) => {
                dataView = new BubbleChartData().getDataView([
                    BubbleChartData.ColumnCategory
                ]);

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const enumerateRes: VisualObjectInstance[] =
                        visualBuilder.instance.enumerateDataPoint("dataPointColor");

                    expect(enumerateRes.length).toEqual(dataView.categorical.categories[0].values.length);

                    done();
                }, 500);
            });

            it("getGroupHighlights method should return empty array if dataView is empty object", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    const highlightsRes: PrimitiveValue[][] =
                        visualBuilder.instance.getGroupHighlights({} as DataView);

                    expect(highlightsRes).toEqual([]);

                    done();
                }, 500);
            });

            it("enumerateObjectInstances method should call enumerateDataPoint method if objectName is dataPointColor", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    const visualInstance: VisualClass = visualBuilder.instance;
                    const options: EnumerateVisualObjectInstancesOptions = {
                        objectName: "dataPointColor"
                    };

                    spyOn(visualInstance, "enumerateDataPoint");

                    visualInstance.enumerateObjectInstances(options);
                    expect(visualInstance.enumerateDataPoint).toHaveBeenCalled();

                    done();
                }, 500);
            });

            it("enumerateObjectInstances method should call enumerateGroupDataPoint method if objectName is dataGroupPointColor", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    const visualInstance: VisualClass = visualBuilder.instance;
                    const options: EnumerateVisualObjectInstancesOptions = {
                        objectName: "dataGroupPointColor"
                    };

                    spyOn(visualInstance, "enumerateGroupDataPoint");

                    visualInstance.enumerateObjectInstances(options);
                    expect(visualInstance.enumerateGroupDataPoint).toHaveBeenCalled();

                    done();
                }, 500);
            });

            it("enumerateObjectInstances method should not return null value if objectName is an empty string", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    const visualInstance: VisualClass = visualBuilder.instance;
                    visualInstance.data.settings = null;
                    const options: EnumerateVisualObjectInstancesOptions = {
                        objectName: ""
                    };

                    expect(visualInstance.enumerateObjectInstances(options)).not.toBeNull();

                    done();
                }, 500);
            });
        });

        describe("Background image feature", () => {
            it("SVG patterns in DOM should be created for every image if image field is set", (done) => {

                dataView = new BubbleChartData().getDataView([
                    BubbleChartData.ColumnCategory,
                    BubbleChartData.ColumnValue,
                    BubbleChartData.ColumnGroup,
                    BubbleChartData.ColumnImage
                ]);

                visualBuilder.updateRenderTimeout(dataView, () => {

                    const imageIds: string[] = defaultDataViewBuilder
                        .valuesCategory.map((c: string) => `${visualBuilder.instance.convertStringToIdFormat(c)}_image`);

                    let countersArray: number[] = new Array(imageIds.length);
                    countersArray = countersArray.fill(0, 0, 4);

                    $(visualBuilder.mainElement).find("defs")
                        .children("pattern").each((idx: number, el: Element) => {
                            const idIdx = imageIds.indexOf($(el).attr("id"));
                            if (idIdx >= 0) {
                                ++countersArray[idIdx];
                            }
                        });

                    expect(countersArray.slice(0, 3).every((c: number) => c === 1)).toEqual(true);

                    done();
                }, 500);
            });

            it("Images should be set as backgrounds for related bubbles if image field is set", (done) => {

                dataView = new BubbleChartData().getDataView([
                    BubbleChartData.ColumnCategory,
                    BubbleChartData.ColumnValue,
                    BubbleChartData.ColumnGroup,
                    BubbleChartData.ColumnImage
                ]);

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const imageIds: string[] = defaultDataViewBuilder
                        .valuesCategory.map((c: string) => `${visualBuilder.instance.convertStringToIdFormat(c)}_image`);

                    const imageCategoryNames: string[] = defaultDataViewBuilder
                        .valuesCategory.slice(0, -1);

                    let countersArray: number[] = new Array(imageIds.length);
                    countersArray = countersArray.fill(0, 0, 4);

                    const secondlayer: Element = $(visualBuilder.mainElement)
                        .children(".layer")
                        .get(1);

                    $(secondlayer).children(".node")
                        .children("circle").each((idx: number, el: Element) => {
                            const categoryName: string = $(el).attr("id");
                            const fill: string = $(el).css("fill");

                            const categoryIdx: number = imageCategoryNames.indexOf(categoryName);
                            const imageId: string = imageIds[categoryIdx];
                            if (imageId !== undefined) {
                                expect(fill).toMatch(new RegExp(`url\\("?#${imageId}"?\\)`));
                            }
                        });

                    done();
                }, 500);
            });
        });

        describe("Hyperlinks feature", () => {
            it("Color of hyperlink should be changed if related setting was changed", (done) => {
                dataView = new BubbleChartData().getDataView([
                    BubbleChartData.ColumnCategory,
                    BubbleChartData.ColumnValue,
                    BubbleChartData.ColumnGroup,
                    BubbleChartData.ColumnHyperlink
                ]);

                const customColor: string = "#00AA00";
                const hyperlinkBubbleIds: string[] = defaultDataViewBuilder
                    .valuesCategory.slice(0, -2);

                dataView.metadata.objects = {
                    labelSettings: {
                        hyperlinkFill: getSolidColorStructuralObject(customColor)
                    }
                };

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const hyperlinkLabelColors: string[] =
                        visualBuilder.getLabelPropertybyCategoryIds(hyperlinkBubbleIds, "fill");

                    hyperlinkLabelColors.forEach((c: string) => {

                        assertColorsMatch(c, customColor);
                    });

                    done();
                }, 500);
            });

            it("Hyperlink should be underlined if hyperlink underline setting is set", (done) => {
                dataView = new BubbleChartData().getDataView([
                    BubbleChartData.ColumnCategory,
                    BubbleChartData.ColumnValue,
                    BubbleChartData.ColumnGroup,
                    BubbleChartData.ColumnHyperlink
                ]);

                const customColor: string = "#00AA00";
                const hyperlinkBubbleIds: string[] = defaultDataViewBuilder
                    .valuesCategory.slice(0, -2);

                dataView.metadata.objects = {
                    labelSettings: {
                        hyperlinkUnderline: true
                    }
                };

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const hyperlinkLabelDecoration: string[] =
                        visualBuilder.getLabelPropertybyCategoryIds(hyperlinkBubbleIds, "text-decoration");

                    expect(hyperlinkLabelDecoration.forEach((dec: string) => {
                        const decFirstWord = dec.split(" ")[0];
                        expect(decFirstWord).toEqual("underline");
                    }));

                    done();
                }, 500);
            });
        });
    });
}
