import { Visual } from "../../src/visual";
import powerbiVisualsApi from "powerbi-visuals-api";
import IVisualPlugin = powerbiVisualsApi.visuals.plugins.IVisualPlugin;
import VisualConstructorOptions = powerbiVisualsApi.extensibility.visual.VisualConstructorOptions;
import DialogConstructorOptions = powerbiVisualsApi.extensibility.visual.DialogConstructorOptions;
var powerbiKey: any = "powerbi";
var powerbi: any = window[powerbiKey];
var reportingLineFE7A9FF0BB834627AE4A13BE3FE59462_DEBUG: IVisualPlugin = {
    name: 'reportingLineFE7A9FF0BB834627AE4A13BE3FE59462_DEBUG',
    displayName: 'reportingLine',
    class: 'Visual',
    apiVersion: '5.3.0',
    create: (options?: VisualConstructorOptions) => {
        if (Visual) {
            return new Visual(options);
        }
        throw 'Visual instance not found';
    },
    createModalDialog: (dialogId: string, options: DialogConstructorOptions, initialState: object) => {
        const dialogRegistry = (<any>globalThis).dialogRegistry;
        if (dialogId in dialogRegistry) {
            new dialogRegistry[dialogId](options, initialState);
        }
    },
    custom: true
};
if (typeof powerbi !== "undefined") {
    powerbi.visuals = powerbi.visuals || {};
    powerbi.visuals.plugins = powerbi.visuals.plugins || {};
    powerbi.visuals.plugins["reportingLineFE7A9FF0BB834627AE4A13BE3FE59462_DEBUG"] = reportingLineFE7A9FF0BB834627AE4A13BE3FE59462_DEBUG;
}
export default reportingLineFE7A9FF0BB834627AE4A13BE3FE59462_DEBUG;