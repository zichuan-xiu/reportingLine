import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
/**
 * Data Point Formatting Card
 */
declare class DataPointCardSettings extends FormattingSettingsCard {
    defaultColor: formattingSettings.ColorPicker;
    showAllDataPoints: formattingSettings.ToggleSwitch;
    fill: formattingSettings.ColorPicker;
    fillRule: formattingSettings.ColorPicker;
    fontSize: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: Array<FormattingSettingsSlice>;
}
export declare class TableSettings extends formattingSettings.SimpleCard {
    showIcons: formattingSettings.ToggleSwitch;
    fontSize: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
}
export declare class ChartSettings extends formattingSettings.SimpleCard {
    showPoints: formattingSettings.ToggleSwitch;
    lineWidth: formattingSettings.NumUpDown;
    pointSize: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
}
/**
* visual settings model class
*
*/
export declare class VisualFormattingSettingsModel extends formattingSettings.Model {
    dataPointCard: DataPointCardSettings;
    tableSettings: TableSettings;
    chartSettings: ChartSettings;
    cards: (DataPointCardSettings | TableSettings | ChartSettings)[];
}
export {};
