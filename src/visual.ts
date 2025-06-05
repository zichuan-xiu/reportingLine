/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";
import * as d3 from 'd3';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewCategorical = powerbi.DataViewCategorical;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;

import { VisualFormattingSettingsModel } from "./settings";
import {color, xml} from "d3";

export class Visual implements IVisual {
    private target: HTMLElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private tableContainer: HTMLElement;
    private chartContainer: HTMLElement;
    private selectedValue: string | null = null;
    private currentOptions: VisualUpdateOptions | null = null;
    private selectedCategory: string | null = null;

    private legendMarginLeft:number = 175;

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;
        this.target.className = "target";
        
        // Create containers for table and chart
        this.tableContainer = document.createElement("div");
        this.tableContainer.className = "table-container";
        this.chartContainer = document.createElement("div");
        this.chartContainer.className = "chart-container";
        
        this.target.appendChild(this.tableContainer);
        this.target.appendChild(this.chartContainer);

    }

    public update(options: VisualUpdateOptions) {
        
        if (!options.dataViews || options.dataViews.length === 0) {
            return;
        }

        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);
        this.currentOptions = options;
        
        // Clear previous content
        this.tableContainer.innerHTML = '';
        this.chartContainer.innerHTML = '';

        const dataView = options.dataViews[0];
        
        if (dataView.categorical) {
            
            // Create table
            this.createTable(dataView.categorical);
            
            // Create chart
            this.createLineChart(dataView.categorical);
        } else {
            console.log('No categorical data');
        }
    }

    private createTable(categorical: DataViewCategorical) {
        // Find xAxis data and its maximum value
        const xAxisData = categorical.categories.find(cat => cat.source.roles.xAxis);
        if (!xAxisData) {
            return;
        }

        // Find all indices with maximum xAxis value
        const maxIndices = xAxisData.values.reduce((indices, current, currentIndex, array) => {
            const currentValue = current.toString();
            if (indices.length === 0) {
                return [currentIndex];
            }
            const maxValue = array[indices[0]].toString();
            if (currentValue > maxValue) {
                return [currentIndex];
            } else if (currentValue === maxValue) {
                return [...indices, currentIndex];
            }
            return indices;
        }, [] as number[]);


        // Create filtered categorical data for each max index
        const filteredCategoricals = maxIndices.map(maxXAxisIndex => ({
            categories: categorical.categories.map(category => ({
                source: category.source,
                values: [category.values[maxXAxisIndex]]
            })),
            values: categorical.values.map(value => ({
                source: value.source,
                values: [value.values[maxXAxisIndex]]
            }))
        } as DataViewCategorical));

        // Sort filteredCategoricals by tableFilter value in ascending order
        filteredCategoricals.sort((a, b) => {
            const aFilter = a.categories.find(cat => cat.source.roles.tableFilter)?.values[0]?.toString() || '';
            const bFilter = b.categories.find(cat => cat.source.roles.tableFilter)?.values[0]?.toString() || '';
            return aFilter.localeCompare(bFilter);
        });

        // console.log("filteredCategoricals: ", filteredCategoricals[0])

        const table = document.createElement("table");
        table.className = "data-table";
        table.style.fontSize = `${this.formattingSettings.tableSettings.fontSize.value}px`;

        // Create header
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        
        // Keep track of used displayNames
        const usedDisplayNames = new Set<string>();

        // Add status column header
        const statusTh = document.createElement("th");
        statusTh.textContent = "Status";
        headerRow.appendChild(statusTh);

        // Add table filter fields
        filteredCategoricals[0].categories.forEach(category => {
            if (category.source.roles.tableFilter && !usedDisplayNames.has(category.source.displayName)) {
                const th = document.createElement("th");
                th.textContent = category.source.displayName;
                headerRow.appendChild(th);
                usedDisplayNames.add(category.source.displayName);
            }
        });

        // Add table data fields
        filteredCategoricals[0].values.forEach(value => {
            if (value.source.roles.tableField && !usedDisplayNames.has(value.source.displayName)) {
                const th = document.createElement("th");
                th.textContent = value.source.displayName;
                headerRow.appendChild(th);
                usedDisplayNames.add(value.source.displayName);
            }
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement("tbody");

        // Create a row for each max index
        filteredCategoricals.forEach(filteredCategorical => {
            const filterColumn = filteredCategorical.categories.find(col => col.source.roles.tableFilter);
            
            // Skip row if TableFilter value is "00"
            if (filterColumn && filterColumn.values[0]?.toString() === "00") {
                return;
            }

            const row = document.createElement("tr");
            const thresholdData = filteredCategorical.categories.find(cat => cat.source.roles.threshold);
            
            // Reset used displayNames for each row
            usedDisplayNames.clear();

            // Add status column with colored circle
            const statusTd = document.createElement("td");
            const circle = document.createElement("div");
            circle.style.width = "12px";
            circle.style.height = "12px";
            circle.style.borderRadius = "50%";
            circle.style.display = "inline-block";
            circle.style.marginRight = "5px";
            
            if (thresholdData) {
                const thresholdValue = thresholdData.values[0]?.toString();
                switch(thresholdValue) {
                    // case "Green":
                    //     circle.style.backgroundColor = "#4fc14f";
                    //     break;
                    case "High Yellow":
                        circle.style.backgroundColor = "#FFD700";
                        break;
                    case "High Red":
                        circle.style.backgroundColor = "#e75a48";
                        break;
                    case "Low Yellow":
                        circle.style.backgroundColor = "#FFD700";
                        break;
                    case "Low Red":
                        circle.style.backgroundColor = "#e75a48";
                        break;
                    // default:
                    //     circle.style.backgroundColor = "#1f77b4";
                }
            }
            
            statusTd.appendChild(circle);
            row.appendChild(statusTd);

            // Add table cells
            filteredCategorical.categories.forEach((category, categoryIndex) => {
                if (category.source.roles.tableFilter && !usedDisplayNames.has(category.source.displayName)) {
                    const td = document.createElement("td");
                    // 实际值
                    const value = category.values[0];
                    // 筛选值
                    const filterValue = filterColumn?.values[0];
                    td.textContent = value.toString();
                    // Add click handler for filtering
                    td.addEventListener("click", () => {
                        if(this.selectedValue){
                            this.selectedValue = null;
                        }else {
                            this.selectedValue = filterValue?.toString() || null;
                        }
                        this.selectedCategory = category.source.displayName;
                        if (this.currentOptions) {
                            this.update(this.currentOptions);
                        }
                    });
                    
                    row.appendChild(td);
                    usedDisplayNames.add(category.source.displayName);
                }
            });

            // Add table data cells
            filteredCategorical.values.forEach(value => {
                if (value.source.roles.tableField && !usedDisplayNames.has(value.source.displayName)) {
                    const td = document.createElement("td");
                    td.textContent = value.values[0].toString();
                    // 筛选值
                    const filterValue = filterColumn?.values[0];
                    // Add click handler for filtering
                    td.addEventListener("click", () => {
                        if(this.selectedValue){
                            this.selectedValue = null;
                        }else {
                            this.selectedValue = filterValue?.toString() || null;
                        }
                        this.selectedCategory = value.source.displayName;
                        if (this.currentOptions) {
                            this.update(this.currentOptions);
                        }
                    });
                    row.appendChild(td);
                    usedDisplayNames.add(value.source.displayName);
                }
            });

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        this.tableContainer.appendChild(table);
    }

    private createLineChart(categorical: DataViewCategorical) {
        const containerWidth = this.chartContainer.clientWidth;
        const containerHeight = this.chartContainer.clientHeight;
        const margin = { top: 40, right: 40, bottom: 80, left: 60 };

        // Calculate actual chart dimensions
        const width = containerWidth - margin.left - margin.right - this.legendMarginLeft;
        const height = containerHeight - margin.top - margin.bottom;

        // Create tooltip div
        const tooltip = d3.select(this.chartContainer)
            .append("div")
            .attr("class", "tooltip");

        const svg = d3.select(this.chartContainer)
            .append("svg")
            .attr("width", containerWidth)
            .attr("height", containerHeight)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Get X and Y axis data
        const xAxisData = categorical.categories.find(cat => cat.source.roles.xAxis);
        const yAxisData = categorical.values.find(val => val.source.roles.yAxis);
        const thresholdData = categorical.categories.find(cat => cat.source.roles.threshold);
        const lineLegendData = categorical.categories.find(cat => cat.source.roles.lineLegend);


        if (!xAxisData || !yAxisData) {
            return;
        }

        const x = d3.scaleBand()
            .domain(xAxisData.values.map(d => d.toString()).sort((a, b) => a.localeCompare(b)))
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, Math.ceil(d3.max(yAxisData.values as number[]) as number) * 10 / 10])
            .range([height, 0]);

        // Calculate the number of labels to show based on width
        const labelWidth = 30; // Approximate width needed for each label
        const maxLabels = Math.floor(width / labelWidth);
        const skipLabels = Math.ceil(xAxisData.values.length / maxLabels);

        // Add X axis
        const xAxis = svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat((d, i) => {
                // Only show labels at intervals when there are more than 8 data points
                return xAxisData.values.length > 20 ? (i % skipLabels === 0 ? d : "") : d;
            }));

        // Rotate x-axis labels if there are more than 8 values
        xAxis.selectAll("text")
            .style("text-anchor", xAxisData.values.length > 8 ? "end" : "middle")
            .attr("dx", xAxisData.values.length > 8 ? "-.8em" : "0")
            .attr("dy", xAxisData.values.length > 8 ? ".15em" : ".71em")
            .attr("transform", xAxisData.values.length > 8 ? "rotate(-45)" : "rotate(0)");

        // Add Y axis
        svg.append("g")
            .call(d3.axisLeft(y));

        // Add X axis grid lines
        xAxis.selectAll(".tick line")
            .clone()
            .attr("y2", -height)
            .attr("stroke", "#c8c6c4")
            .attr("stroke-opacity", 0.5);

        // Add Y axis grid lines
        const yAxis = svg.append("g")
            .call(d3.axisLeft(y));
        yAxis.selectAll(".tick line")
            .clone()
            .attr("x2", width)
            .attr("stroke", "#c8c6c4")
            .attr("stroke-opacity", 0.5);
        yAxis.select(".domain").remove();

        // Group data by line legend if available
        const groupedData = lineLegendData ? 
            this.groupDataByLegend(xAxisData, yAxisData, lineLegendData) :
            [{ legend: '', values: yAxisData.values.map((v, i) => ({ x: xAxisData.values[i], y: v, index: i })) }];

        // Sort values in each group according to x-axis order
        groupedData.forEach(group => {
            group.values.sort((a, b) => a.x.toString().localeCompare(b.x.toString()));
        });

        // 只保留 legend 等于选中值的折线
        const filteredData = groupedData.filter(group => {
            if (!this.selectedValue) return true;
            return group.legend === this.selectedValue;
        });

        filteredData.sort((a,b)=>{
            const aFilter = a.legend;
            const bFilter = b.legend;
            return aFilter.localeCompare(bFilter);
        })

        // console.log("filteredData",filteredData)

        // Create lines
        filteredData.forEach((group, index) => {
            const line = d3.line<{x: any, y: number, index: number}>()
                .x(d => x(d.x.toString())! + x.bandwidth() / 2)
                .y(d => y(d.y));

            // Show all points in the line, not just the filtered ones
            const data = group.values as {x: any, y: number, index: number}[];

            // Get line color based on line legend
            const lineColor = this.getLineColor(index, data, lineLegendData);

            // Create line path
            svg.append("path")
                .datum(data)
                .attr("fill", "none")
                .attr("stroke", lineColor)
                .attr("stroke-width", this.formattingSettings.chartSettings.lineWidth.value)
                .attr("d", line as any)
                .style("cursor", "pointer")
                .on("click", (event, d) => {
                    // Toggle selection
                    if (this.selectedValue === group.legend) {
                        this.selectedValue = null;
                    } else {
                        this.selectedValue = group.legend;
                    }
                    // 触发刷新
                    if (this.currentOptions) {
                        this.update(this.currentOptions);
                    }
                    // Update all lines
                    svg.selectAll("path")
                        .attr("stroke-width", function(d) {
                            const pathData = d as {x: any, y: number, index: number}[];

                            if (!pathData || pathData.length === 0 || this.selectedValue == null) {
                                return this.formattingSettings.chartSettings.lineWidth.value;
                            }
                            
                            const pathGroup = groupedData.find(g => {
                                if (!g || !g.values || g.values.length === 0) {
                                    return false;
                                }
                                const match = g.values[0].x === pathData[0].x && g.values[0].y === pathData[0].y;
                                return match;
                            });
                            return pathGroup?.legend === this.selectedValue ? 
                                this.formattingSettings.chartSettings.lineWidth.value * 2 : 
                                this.formattingSettings.chartSettings.lineWidth.value;
                        }.bind(this))
                        .attr("stroke-opacity", function(d) {
                            const pathData = d as {x: any, y: number, index: number}[];
                            if (!pathData || pathData.length === 0) return 0.3;
                            if (this.selectedValue == null) return 1;
                            const pathGroup = groupedData.find(g => {
                                if (!g || !g.values || g.values.length === 0) return false;
                                return g.values[0].x === pathData[0].x && g.values[0].y === pathData[0].y;
                            });
                            return pathGroup?.legend === this.selectedValue ? 1 : 0.3;
                        }.bind(this));

                    // Update all points
                    svg.selectAll("circle")
                        .attr("r", function(d) {
                            const pointData = d as {x: any, y: number, index: number};
                            if (!pointData) {
                                return this.formattingSettings.chartSettings.pointSize.value;
                            }
                            if (this.selectedValue == null) return this.formattingSettings.chartSettings.pointSize.value;
                            const pointGroup = groupedData.find(g => {
                                if (!g || !g.values || g.values.length === 0) return false;
                                return g.values.some(v => v.x === pointData.x && v.y === pointData.y);
                            });
                            return pointGroup?.legend === this.selectedValue ? 
                                this.formattingSettings.chartSettings.pointSize.value * 1.5 : 
                                this.formattingSettings.chartSettings.pointSize.value;
                        }.bind(this))
                        .attr("fill-opacity", function(d) {
                            const pointData = d as {x: any, y: number, index: number};
                            if (!pointData) return 0.3;
                            if (this.selectedValue == null) return 1;
                            const pointGroup = groupedData.find(g => {
                                if (!g || !g.values || g.values.length === 0) return false;
                                return g.values.some(v => v.x === pointData.x && v.y === pointData.y);
                            });
                            return pointGroup?.legend === this.selectedValue ? 1 : 0.3;
                        }.bind(this));
                });

            // Add points if enabled
            if (this.formattingSettings.chartSettings.showPoints.value) {
                svg.selectAll(`.point-${index}`)
                    .data(data)
                    .enter()
                    .append("path")
                    .attr("class", `point-${index}`)
                    .attr("d", d => {
                        const pointData = d as {x: any, y: number, index: number};
                        const thresholdLabel = thresholdData?.values[pointData.index]?.toString();
                        const pointX = x((d as any).x.toString())! + x.bandwidth() / 2;
                        const pointY = y((d as any).y);
                        const size = this.formattingSettings.chartSettings.pointSize.value;
                        // console.log(thresholdLabel)
                        
                        if (thresholdLabel === "High Red" || thresholdLabel === "High Yellow") {
                            // Create triangle path
                            return `M ${pointX} ${pointY - size} L ${pointX - size} ${pointY + size} L ${pointX + size} ${pointY + size} Z`;
                        } else if (thresholdLabel === "Low Red" || thresholdLabel === "Low Yellow"){
                            return `M ${pointX} ${pointY + size} L ${pointX - size} ${pointY - size} L ${pointX + size} ${pointY - size} Z`;
                        } else {
                            // Create circle path
                            return `M ${pointX + size} ${pointY} a ${size} ${size} 0 1,0 ${-size * 2} 0 a ${size} ${size} 0 1,0 ${size * 2} 0`;
                        }
                    })
                    .attr("fill", d => this.getPointColor(d as {x: any, y: number, index: number}, thresholdData))
                    .style("cursor", "pointer")
                    .on("mouseover", (event, d) => {
                        const pointData = d as {x: any, y: number, index: number};
                        const legendData = lineLegendData.values;
                        // const xAxisName = xAxisData.source.displayName;
                        const yAxisName = yAxisData.source.displayName;
                        const legendName = lineLegendData.source.displayName
                        
                        // Calculate point position
                        const pointX = x(pointData.x.toString())! + x.bandwidth() / 2;
                        const pointY = y(pointData.y);
                        
                        tooltip.transition()
                            .duration(200)
                            .style("opacity", .9);
                        
                        tooltip.html(`${legendName}: ${legendData[pointData.index]}<br/>${yAxisName}: ${pointData.y}`)
                            .style("left", (pointX + 10) + "px")
                            .style("top", (pointY - 10) + "px");
                    })
                    .on("mouseout", () => {
                        tooltip.transition()
                            .duration(500)
                            .style("opacity", 0);
                    })
                    .on("click", (event, d) => {
                        // Find the corresponding line and trigger its click event
                        const pointData = d as {x: any, y: number, index: number};
                        const pointGroup = groupedData.find(g => 
                            g.values.some(v => v.x === pointData.x && v.y === pointData.y)
                        );
                        if (pointGroup) {
                            // Toggle selection
                            if (this.selectedValue === pointGroup.legend) {
                                this.selectedValue = null;
                            } else {
                                this.selectedValue = pointGroup.legend;
                            }
                        // 触发刷新
                        if (this.currentOptions) {
                            this.update(this.currentOptions);
                        }
                        // Update all lines
                        svg.selectAll("path")
                            .attr("stroke-width", function(d) {
                                const pathData = d as {x: any, y: number, index: number}[];
                                if (!pathData || pathData.length === 0) return this.formattingSettings.chartSettings.lineWidth.value;

                                const pathGroup = groupedData.find(g => {
                                    if (!g || !g.values || g.values.length === 0) return false;
                                    return g.values[0].x === pathData[0].x && g.values[0].y === pathData[0].y;
                                });
                                return pathGroup?.legend === this.selectedValue ?
                                    this.formattingSettings.chartSettings.lineWidth.value * 2 :
                                    this.formattingSettings.chartSettings.lineWidth.value;
                            }.bind(this))
                            .attr("stroke-opacity", function(d) {
                                const pathData = d as {x: any, y: number, index: number}[];
                                if (!pathData || pathData.length === 0) return 0.3;
                                if (this.selectedValue == null) return 1;
                                const pathGroup = groupedData.find(g => {
                                    if (!g || !g.values || g.values.length === 0) return false;
                                    return g.values[0].x === pathData[0].x && g.values[0].y === pathData[0].y;
                                });
                                return pathGroup?.legend === this.selectedValue ? 1 : 0.3;
                            }.bind(this));

                        // Update all points
                        svg.selectAll("circle")
                            .attr("r", function(d) {
                                const pointData = d as {x: any, y: number, index: number};
                                if (!pointData) return this.formattingSettings.chartSettings.pointSize.value;
                                if (this.selectedValue == null) return this.formattingSettings.chartSettings.pointSize.value;
                                const pointGroup = groupedData.find(g => {
                                    if (!g || !g.values || g.values.length === 0) return false;
                                    return g.values.some(v => v.x === pointData.x && v.y === pointData.y);
                                });
                                return pointGroup?.legend === this.selectedValue ?
                                    this.formattingSettings.chartSettings.pointSize.value * 1.5 :
                                    this.formattingSettings.chartSettings.pointSize.value;
                            }.bind(this))
                            .attr("fill-opacity", function(d) {
                                const pointData = d as {x: any, y: number, index: number};
                                if (!pointData) return 0.3;
                                if (this.selectedValue == null) return 1;
                                const pointGroup = groupedData.find(g => {
                                    if (!g || !g.values || g.values.length === 0) return false;
                                    return g.values.some(v => v.x === pointData.x && v.y === pointData.y);
                                });
                                return pointGroup?.legend === this.selectedValue ? 1 : 0.3;
                            }.bind(this));
                        }
                    });
            }
        });

        // 图标
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width + 50}, 0)`);

        filteredData.forEach((group, index) => {
            const data = group.values as {x: any, y: number, index: number}[];
            legend.append("text").text("Site");
            const legendItem = legend.append("g")
                .attr("transform", `translate(0, ${index * 25 + 25})`)
                .style("cursor", "pointer")
            // 颜色线
            legendItem.append("line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", 20)
                .attr("y2", 0)
                .attr("stroke", this.getLineColor(index,data,lineLegendData))
                .attr("stroke-width", 2);
            // 文本
            legendItem.append("text")
                .attr("x", 25)
                .attr("y", 4)
                .text(group.legend)
                .style("font-size", "12px")
                .style("fill", "#666");
        });

        // 添加阈值点图例
        if (thresholdData) {
            const thresholdValue = categorical.values.find(col => "Threshold Mark" == col.source.displayName)?.values;
            const thresholdLegend = svg.append("g")
                .attr("class", "threshold-legend")
                .attr("transform", `translate(${width + 50}, ${filteredData.length * 25 + 50})`);

            thresholdLegend.append("text")
                .text("Threshold Mark");
            let legendIndex = 0;
            const legendTypes = [
              { color: "#4fc14f", label: "Green", index: thresholdData.values.indexOf("Green") },
              { color: "#FFD700", label: "High Yellow", index: thresholdData.values.indexOf("High Yellow") },
              { color: "#FFD700", label: "Low Yellow", index: thresholdData.values.indexOf("Low Yellow") },
              { color: "#e75a48", label: "High Red", index: thresholdData.values.indexOf("High Red") },
              { color: "#e75a48", label: "Low Red", index: thresholdData.values.indexOf("Low Red") }
            ];

            legendTypes.forEach(type => {
              if (type.index >= 0) {
                const legend = thresholdLegend.append("g")
                  .attr("transform", `translate(0, ${legendIndex * 25 + 25})`);
                if (type.label === "High Red" || type.label === "High Yellow") {
                    // Create triangle for Red and Yellow
                    const size = this.formattingSettings.chartSettings.pointSize.value;
                    legend.append("path")
                        .attr("d", `M 10 ${-size} L ${10 - size} ${size} L ${10 + size} ${size} Z`)
                        .attr("fill", type.color);
                } else if (type.label === "Low Red" || type.label === "Low Yellow") {
                    const size = this.formattingSettings.chartSettings.pointSize.value;
                    legend.append("path")
                        .attr("d", `M 10 ${size} L ${10 - size} ${-size} L ${10 + size} ${-size} Z`)
                        .attr("fill", type.color);
                } else{
                    // Create circle for others
                    // legend.append("circle")
                    //     .attr("cx", 10)
                    //     .attr("cy", 0)
                    //     .attr("r", this.formattingSettings.chartSettings.pointSize.value)
                    //     .attr("fill", type.color);
                    return
                }
                
                legend.append("text")
                  .attr("x", 25)
                  .attr("y", 4)
                  .text(thresholdValue[type.index].toString())
                  .style("font-size", "12px")
                  .style("fill", "#666");
                legendIndex++;
              }
            });
        }
    }

    private groupDataByLegend(xAxisData: DataViewCategoryColumn, yAxisData: DataViewValueColumn, lineLegendData: DataViewCategoryColumn) {
        const groups = new Map<string, {x: any, y: number, index: number}[]>();
        
        xAxisData.values.forEach((x, i) => {
            const legendValue = lineLegendData.values[i].toString();
            if (!groups.has(legendValue)) {
                groups.set(legendValue, []);
            }
            groups.get(legendValue)!.push({
                x: x,
                y: yAxisData.values[i] as number,
                index: i
            });
        });

        return Array.from(groups.entries()).map(([legend, values]) => ({
            legend,
            values: values as {x: any, y: number, index: number}[]
        }));
    }

    private getLineColor(index: number, data: {x: any, y: number, index: number}[], lineLegendData?: DataViewCategoryColumn): string {
        if (lineLegendData) {
            const legendValue = lineLegendData.values[data[0]?.index];
            switch(legendValue?.toString()) {
                case "01":
                    return '#3e5266';
                case "0101":
                    return '#3e5266';
                case "02":
                    return '#ffc660';
                case "0102":
                    return '#ffc660';
                case "03":
                    return '#d2e2aa';
                default:
                    return '#3599b8';
            }
        }
        
        const colors = ['#3e5266', '#ffc660', '#d2e2aa', '#3599b8', '#9467bd'];
        return colors[index % colors.length];
    }

    private getPointColor(point: {x: any, y: number, index: number}, thresholdData?: DataViewCategoryColumn): string {
        if (!thresholdData) {
            return '#1f77b4';
        }
        const thresholdLabel = thresholdData.values[point.index]?.toString();

        if (thresholdLabel === "High Yellow" || thresholdLabel === "Low Yellow") {
            return '#FFD700';
        }
        if (thresholdLabel === "High Red" || thresholdLabel === "Low Red") {
            return '#e75a48'
        }
        if (thresholdLabel === "Green"){
            return '#4FC14F'
        }


        // Default color
        return '#4FC14F';
    }

    /**
     * Returns properties pane formatting model content hierarchies, properties and latest formatting values, Then populate properties pane.
     * This method is called once every time we open properties pane or when the user edit any format property. 
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}