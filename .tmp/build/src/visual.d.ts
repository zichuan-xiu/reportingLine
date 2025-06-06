import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
export declare class Visual implements IVisual {
    private target;
    private formattingSettings;
    private formattingSettingsService;
    private tableContainer;
    private chartContainer;
    private selectedValue;
    private currentOptions;
    private selectedCategory;
    private legendMarginLeft;
    constructor(options: VisualConstructorOptions);
    update(options: VisualUpdateOptions): void;
    private createTable;
    private createLineChart;
    private groupDataByLegend;
    private getLineColor;
    private getPointColor;
    /**
     * Returns properties pane formatting model content hierarchies, properties and latest formatting values, Then populate properties pane.
     * This method is called once every time we open properties pane or when the user edit any format property.
     */
    getFormattingModel(): powerbi.visuals.FormattingModel;
}
