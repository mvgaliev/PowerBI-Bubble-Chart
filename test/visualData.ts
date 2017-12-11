/// <reference path="_references.ts"/>

module powerbi.extensibility.visual.test {
    import ValueType = powerbi.extensibility.utils.type.ValueType;

    import CustomizeColumnFn = powerbi.extensibility.utils.test.dataViewBuilder.CustomizeColumnFn;
    import TestDataViewBuilder = powerbi.extensibility.utils.test.dataViewBuilder.TestDataViewBuilder;

    export class BubbleChartData extends TestDataViewBuilder {
        public static ColumnCategory: string = "City";
        public static ColumnGroup: string = "Country";
        public static ColumnValue: string = "Population";
        public static ColumnImage: string = "Image";
        public static ColumnHyperlink: string = "Hyperlink";

        public valuesCategory: string[] = ["Tokyo", "Delhi", "Shanghai", "São Paulo"];
        public valuesGroup: string[] = ["Japan", "India", "China", "Brazil"];
        public valuesValue: number[] = [38001, 20238, 25703, 23741];
        public valuesImageUrl: string[] = [
            "https://upload.wikimedia.org/wikipedia/en/thumb/9/9e/Flag_of_Japan.svg/1200px-Flag_of_Japan.svg.png",
            "https://upload.wikimedia.org/wikipedia/en/thumb/4/41/Flag_of_India.svg/1350px-Flag_of_India.svg.png",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Flag_of_the_People%27s_Republic_of_China.svg/900px-Flag_of_the_People%27s_Republic_of_China.svg.png",
            "",
        ];
        public valuesHyperlink: string[] = [
            "https://upload.wikimedia.org/wikipedia/en/thumb/9/9e/Flag_of_Japan.svg/1200px-Flag_of_Japan.svg.png",
            "https://upload.wikimedia.org/wikipedia/en/thumb/4/41/Flag_of_India.svg/1350px-Flag_of_India.svg.png",
            "",
            "",
        ];

        public getDataView(columnNames?: string[], customizeColumns?: CustomizeColumnFn): DataView {

            return this.createCategoricalDataViewBuilder([
                {
                    source: {
                        displayName: BubbleChartData.ColumnCategory,
                        roles: { category: true },
                        type: ValueType.fromDescriptor({ text: true }),
                    },
                    values: this.valuesCategory
                },
                {
                    isGroup: true,
                    source: {
                        displayName: BubbleChartData.ColumnGroup,
                        roles: { grouping: true },
                        type: ValueType.fromDescriptor({ text: true })
                    },
                    values: this.valuesGroup
                },
                {
                    source: {
                        displayName: BubbleChartData.ColumnImage,
                        roles: { image: true },
                        type: ValueType.fromDescriptor({ text: true })
                    },
                    values: this.valuesImageUrl
                },
                {
                    source: {
                        displayName: BubbleChartData.ColumnHyperlink,
                        roles: { hyperlink: true },
                        type: ValueType.fromDescriptor({ text: true })
                    },
                    values: this.valuesHyperlink
                }
            ], [
                    {
                        source: {
                            displayName: BubbleChartData.ColumnValue,
                            isMeasure: true,
                            roles: { measure: true },
                            type: ValueType.fromDescriptor({ numeric: true }),
                            objects: { dataPoint: { fill: { solid: { color: "purple" } } } },
                        },
                        values: this.valuesValue
                    }], columnNames, customizeColumns).build();
        }
    }
}