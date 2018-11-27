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

module powerbi.extensibility.visual {
    "use strict";
    
    export class Visual implements IVisual {
        private target: HTMLElement;
        private host: IVisualHost;
        private selectionManager: ISelectionManager;
        private settings: VisualSettings;
        private container: HTMLElement;

        private currentValue: Number = 0.00;
        private slider: any;
        private isApplySelectionFilterUpdate = false; // This is here to prevent an endless loop of updates, from the slider set to the update method.
        private selectionIds: any = {}

        private visualSettings: VisualSettings
        private dataView: DataView;
        

        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            this.target = options.element;
            this.selectionManager = options.host.createSelectionManager();
        }

        /** 
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the 
         * objects and properties you want to expose to the users in the property pane.
         * 
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            const settings: VisualSettings = this.settings || VisualSettings.getDefault() as VisualSettings;
            return VisualSettings.enumerateObjectInstances(settings, options);
        }

        public update(options: VisualUpdateOptions) {
            this.getSettings(options);

            if (options.type & powerbi.VisualUpdateType.Data && !this.isApplySelectionFilterUpdate) {
                this.init(options);
            }
        }

        public init(options: VisualUpdateOptions) {
            var data = this.getData(options);
            if (data) {
                this.initSlider(data);
            }
        }


        public getData(options: VisualUpdateOptions): any {

            // Make sure we have category data
            if (!options ||
                !options.dataViews ||
                !options.dataViews[0] ||
                !options.dataViews[0].categorical ||
                !options.dataViews[0].categorical.categories ||
                !options.dataViews[0].categorical.categories[0]) {
                return null;
            }

            
            let dataView = options.dataViews[0];
            let categorical = dataView.categorical;
            let category = categorical.categories[0];

            // asc sort and remove empty values then convert values to percentage
            let values = category.values.sort((n1: number, n2: number) => n1 - n2).map((v: number) => v*100);

            // build selection ids to be used by filtering capabilities later
            values.forEach((item: number, index: number) => {
                this.selectionIds[item] = this.host.createSelectionIdBuilder()
                    .withCategory(category, index)
                    .createSelectionId()
            });

            // Build up the range so we have a step for each value in the dataset.
            let step: number = 0;
            let range: any = {};
            range.min = range['0%'] = values[0];
            range.max = range['100%'] = values[values.length - 1];

            if (values.length > 1) {
                // Add the rest of the values.
                for (var i = 1; i <= values.length - 2; i++) {
                    step = (100 / (values.length - 1)) + step;
                    range[step + '%'] = values[i]
                }
            }

            return {
                range: range
            }
        }
        
        public initSlider(data: any) {
            let that = this; // This is needed for the slider event handlers

            // remove any children from previous slider renders
            while (this.target.firstChild) {
                this.target.removeChild(this.target.firstChild);
            }

            // Put slider in a container so we can style it independent of the host container.
            this.container = document.createElement('div');
            this.container.className = 'container';
            this.target.appendChild(this.container);

            this.slider = noUiSlider.create(this.container, {
                start: this.currentValue, //|| this.visualSettings.data.defaultSelectedValue || data.range.min,
                connect: true,
                step: 5,
                range: data.range,
                snap: true,
                tooltips: true,
                format: {
                    to: function (value) {
                        return String(Math.round(Number(value))) + '%';
                    },
                    from: function (value) {
                        return Number(value.replace('%','')).toFixed(2);
                    }
                }
                /*,
                pips: {
                    mode: 'steps',
                    stepped: true,
                    density: 10,
                    filter: this.filterPips
                }*/
            });
            
            this.filter(this.slider.get());
            this.slider.on('set', this.filter.bind(this));
        }

        private filter(values) {
            
            //debugger;
            //console.log('filterReport');
            //console.log(String(values[0]))
            //console.log(Number(values[0].replace('%','')).toFixed(2));

            this.isApplySelectionFilterUpdate = true;

            let value = parseFloat(values[0].replace('%','')).toFixed(2) || values;
            this.currentValue = value;

            //debugger;
            //console.log('filterReport');
            //console.log(String(value));

            this.selectionManager.select(this.selectionIds[Math.round(Number(value))]).then((ids: ISelectionId[]) => {
                    //ids.forEach(function (id) {
                    //    console.log(id);
                    //});
            });
            

            //this.selectionManager.applySelectionFilter();
        }

        private getSettings(options: VisualUpdateOptions): boolean {
            let changed = false;
            let dataView = options.dataViews[0];

            if (dataView) {
                this.visualSettings = VisualSettings.parse(dataView) as VisualSettings;
                this.visualSettings.data.defaultSelectedValue = Math.max(-1, this.visualSettings.data.defaultSelectedValue)
                this.visualSettings.data.defaultSelectedValue = Math.min(1, this.visualSettings.data.defaultSelectedValue);

                this.visualSettings.sliderStyle.barWidth = Math.max(3, this.visualSettings.sliderStyle.barWidth)
                this.visualSettings.sliderStyle.barWidth = Math.min(20, this.visualSettings.sliderStyle.barWidth);
                
            }

            //console.log("Bar Width")
            //console.log(this.visualSettings.sliderStyle.barWidth)
            //var bar = document.getElementsByClassName(".noUi-horizontal")[0] as HTMLElement
            //bar.style.height = this.visualSettings.sliderStyle.barWidth + ''
            
            return changed;
        }


        private static parseSettings(dataView: DataView): VisualSettings {
            return VisualSettings.parse(dataView) as VisualSettings;
        }

    }
}