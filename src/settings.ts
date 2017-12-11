module powerbi.extensibility.visual {
    "use strict";
    import DataViewObjectsParser = powerbi.extensibility.utils.dataview.DataViewObjectsParser;
    import LegendPosition = powerbi.extensibility.utils.chart.legend.LegendPosition;

    export class VisualSettings extends DataViewObjectsParser {
        public dataPointColor: ColorSettings = new ColorSettings();
        public dataGroupPointColor: ColorSettings = new ColorSettings();
        public labelSettings: LabelSettings = new LabelSettings();
        public commonSettings: CommonSettings = new CommonSettings();
        public legendSettings: LegendSettings = new LegendSettings();
    }

    export class ColorSettings {
        public fill: string = "#FFFFFF";
    }

    export class LegendSettings {
        public show: boolean = true;
        public name: string = "";
        public fontSize: number = 11;
        public position: LegendPosition = LegendPosition.Top;
    }

    export class CommonSettings {
        public padding: number = 1.5;

        public parse() {
            this.padding = Math.max(Math.min(this.padding, 10), 0);
        }
    }

    export class LabelSettings extends ColorSettings {
        public hyperlinkFill: string = "#0000EE";
        public show: boolean = true;
        public bold: boolean = false;
        public italic: boolean = false;
        public underline: boolean = false;
        public hyperlinkUnderline: boolean = true;
        public fontSize: number = 11;

        public get fontSizeInPx() {
            return `${this.fontSize}px`;
        }

        public get boldAsString() {
            return this.bold ? "bold" : "normal";
        }

        public get italicAsString() {
            return this.italic ? "italic" : "normal";
        }

        public get underlineAsString() {
            return this.getUnderlineSetting(this.underline);
        }

        public get hyperlinkUnderlineAsString() {
            return this.getUnderlineSetting(this.hyperlinkUnderline);
        }

        private getUnderlineSetting(isUnderline: boolean): string {
            return isUnderline ? "underline" : "none";
        }

        public parse(areHyperlinksSpecified: boolean) {
            Object.defineProperties(
                this,
                {
                    hyperlinkFill: { enumerable: areHyperlinksSpecified },
                    hyperlinkUnderline: { enumerable: areHyperlinksSpecified },
                });
        }
    }
}
