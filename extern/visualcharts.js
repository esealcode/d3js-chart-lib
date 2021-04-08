// The library
window.visualcharts = (function () {
    'use strict';

    var visual_charts = {
        "version": "0.0.1",
        "DataIterator": new DataIterator(),
        "focus": null,
        "eventHandlers": {}
    };

    // A module which help to iterate unknown structured data
    function DataIterator() {
        // ...
    }

    DataIterator.prototype.each = function (data, callback, bind_call) {
        if ( bind_call ) callback = callback.bind(bind_call);

        if ( data instanceof Object ) {
            var k_table = Object.keys(data);
            for ( var i=0; i < k_table.length; i++ )
                callback(data[k_table[i]], i, k_table[i]);
        }
        else if ( data instanceof Array ) {
            for ( var i=0; i < data.length; i++ )
                callback(data[i], i);
        }
    }

    DataIterator.prototype.walk = function (object, callback, bind_call) {
        if ( bind_call ) callback = callback.bind(bind_call);

        if ( data instanceof Object ) {
            var k_table = Object.keys(data);
            for ( var i=0; i < k_table.length; i++ )
                callback(data[k_table[i]], i, k_table[i]);
        }
        else if ( data instanceof Array ) {
            for ( var i=0; i < data.length; i++ )
                callback(data[i], i);
        }
    }

    function Chart2D(object) {
        /* Update */
        this.architecture = {
            "dimensions": {
                "paddings": {top: 30, right: 20, bottom: 30, left: 70},
                "svg": {width: null, height: null},
                "draw": {width: 300, height: 100},
                "chart": {width: 300, height: 100}
            },
            "DOM": {
                "container": null,
                "svg": null,
                "svgPad": null,
                "graph": null,
                "drawArea": null,
                "followLine": null,
                "tooltip": null
            },
            "styles": {}
        };

        this.utils = {
            "x_m_domain": 0,
            "y_m_domain": 0,
            "colorset": d3.schemeCategory10,
            "scales": {
                'x_scale': null,
                'y_scale': null
            },
            "axes": {
                'x_axis': null,
                'y_axis': null
            },
            "accessors": {
                'y_axis_txt': null,
                'x_axis_txt': null,

                // Define default accessors
                'x_data_accessor': function (d, i) {
                    if ( d instanceof Object ) 
                        return d[Object.keys(d)[0]];
                    else if ( d instanceof Array )
                        return d[0];
                    else return 0;
                },
                'y_data_accessor': function (d, i) {
                    if ( d instanceof Object ) 
                        return d[Object.keys(d)[1]];
                    else if ( d instanceof Array )
                        return d[1];
                    else return 0;
                }
            },
            "symbol": {
                "symbol": d3.symbol().type(d3.symbolCircle).size(30),
                "size": 30
            },
            "cache": {
                "n_dot": null,
                "behaviorRst": [],
            }
        }
        
        /* End of update */
        this.uuid = visualcharts.guid();

        // Line builders
            // Graph line builder
            this.buildLine =  d3.line().curve(d3.curveCatmullRom);

        this._dataset = null;
    }

    Chart2D.prototype.setup = function (object) {
        if ( "width" in object )
            this.setChartW(object.width);
        
        if ( "height" in object )
            this.setChartH(object.height);
        
        if ( "colorset" in object )
            this.setColorset(object.colorset);

        if ( "accessors" in object ) {
            if ( "yAxisTxt" in object.accessors )
                this.setYAxisTxt(object.accessors.yAxisTxt);
            if ( "xAxisTxt" in object.accessors )
                this.setXAxisTxt(object.accessors.xAxisTxt);
            if ( "yDataAccessor" in object.accessors)
                this.setYDataAccessor(object.accessors.yDataAccessor);
            if ( "xDataAccessor" in object.accessors)
                this.setXDataAccessor(object.accessors.xDataAccessor);
        }

        if ( "tooltip" in object ) 
            this.setTooltip(object.tooltip);
        
        return this;
    }

    // This method provide a way to automaticly update the svg size to correctly fill all potential updated elements in SVG
    Chart2D.prototype.updateSvgSize = function () {
        var childs = this.getSvg().node().children;
        var n_height = this.getPadding("top"),
            n_width = 0;

        var bound;

        for ( var i=0; i < childs.length; i++ ) {
            bound = childs[i].getBoundingClientRect();
            n_height += bound.height;
            n_width = bound.width > n_width ? bound.width : n_width;
        }
        
        this.getSvg().attr("height", n_height).attr("width", this.getPadding("left") + n_width);
    }

    // This method will bind the chart by filling the element passed as argument with a fresh svg element
    Chart2D.prototype.bind = function (e) {
        if ( this.getContainer() != null ) { // The graph was already binded to another element, we need to remove it
            this.getSvg().remove();

            // Taking off references
            this.setContainer(null);
            this.setSvg(null);
            this.setSvgPad(null);
            this.setGraph(null);
        }

        this.setContainer( (typeof e != 'object') ? document.getElementById(e.replace('#', '')) : e ); // The bind actually takes effect here
        if ( this.getContainer() === null ) {
            console.log("Unable to find container.");
            return false;
        }

        this.setSvg( d3.select(this.getContainer()).append('svg') );
        this.getSvg().attr("width", this.getSvgWidth())
                     .attr("height", this.getSvgHeight())
                     .append("defs").append("clipPath")
                                    .attr("id", "clip-" + this.getUUID())
                                    .append("rect")
                                    .attr("width", this.getChartWidth())
                                    .attr("height", this.getChartHeight());

        // Each time client mouse enter the area of this charts, it will update the focus variable of VisualCharts to let it handle correctly events for this chart in the future
        this.setSvgPad( this.getSvg().append("g").attr("transform", "translate(" + this.getPadding("left") + ", " + this.getPadding("top") + ")").on("mouseenter", (function () { visualcharts.focus = this }).bind(this) ) );

        // Build graph container
        this.setGraph( this.getSvgPad().append("g").attr("class", "graph").on("mouseenter", visual_charts.eventHandlers.viewPathRect).on("mouseleave", visual_charts.eventHandlers.hidePathRect) );
        this.getGraph().append("rect").attr("class", "overlay").on("mousemove", visual_charts.eventHandlers.hoverRectMouseMove).attr("width", this.getChartWidth()).attr("height", this.getChartHeight());

        this.setDrawArea( this.getGraph().append("g").attr("class", "draw").style("clip-path", "url(#clip-" + this.getUUID() + ")") );

        // Build scales
        this.setXScale( d3.scaleLinear()
                                .domain([0, this.getXMaxDomain()])
                                .range([0, this.getChartWidth()]) );


        this.setYScale( d3.scaleLinear()
                                .domain([0, this.getYMaxDomain()])
                                .range([this.getChartHeight(), 0]) );

        // Build axes
        this.setXAxis( d3.axisBottom(this.getXScale()).ticks(10).tickFormat(this.getXAxisTxt()) );
        this.setYAxis( d3.axisLeft(this.getYScale()).ticks(3).tickFormat(this.getYAxisTxt()).tickSize(-this.getChartWidth()) );

        // Append the X Axis
        this.getGraph().append("g").attr("class", "axis axis--x").attr("transform", "translate(0," + this.getChartHeight() + ")").call(this.getXAxis());
        
        // Append the Y Axis
        this.getGraph().append("g").attr("class", "axis axis--y").call(this.getYAxis());

        this.setFollowLine( this.getDrawArea().append("line").attr("stroke", "#ccc").attr("stroke-width", 1.5).attr("stroke-dasharray", "1, 3").attr("stroke-linecap", "round").attr("y1", this.getChartHeight()) );

        this.getGraph().append("circle").attr("fill", "#4184F3").attr("r", 4.5).attr("cx", 0).attr("cy", 0).attr("class", "dot").style("display", "none");
        if ( this._dataset != null )
            this.dataset(this._dataset);

        this.updateSvgSize();
        console.log("Graph bound.");
        return this;
    }
    
    Chart2D.prototype.unbind = function () {
        if ( this.getContainer() != null ) { // The graph was already binded to another element, we need to remove it
            this.getSvg().remove();

            // Taking off references
            this.setContainer(null);
            this.setSvg(null);
            this.setSvgPad(null);
            this.setGraph(null);
        }

        return this;
    }

    Chart2D.prototype._update = function () {
            this.getSvg().select(".overlay").attr("width", this.getChartWidth()).attr("height", this.getChartHeight());
            this.getSvg().select("clipPath").select("rect")
                                            .attr("width", this.getChartWidth())
                                            .attr("height", this.getChartHeight());

            this.getXScale().range([0, this.getChartWidth()]);
            this.getYScale().range([this.getChartHeight(), 0]);

            this.getGraph().select(".axis--x").attr("transform", "translate(0, " + this.getChartHeight() + ")").call(this.getXAxis());
            this.getYAxis().tickSize(-this.getChartWidth());
            this.getGraph().select(".axis--y").call(this.getYAxis());
            
            this.getDrawArea().selectAll(".graphLine").attr("d", this.buildLine);
            this.getDrawArea().selectAll(".plot").attr("transform", (function (d, i) { 
                                                        var t_x = this.getXScale()(this.getXDataAccessor()(d, i)), t_y = this.getYScale()(this.getYDataAccessor()(d, i));
                                                        return "translate(" + t_x + ", " + t_y + ")";
                                                    }).bind(this))
                                                    .attr("x", (function (d) { return this.getXScale()(d[0]); }).bind(this));
    }

    // This method will set a new width to the chart and update the svg element if exists
    Chart2D.prototype.width = function (w) {
        this.setChartW(w);

        this.getDrawArea().attr("width", w);
        this.getSvg().select(".context").attr("width", w);
        this._update();
        this.updateSvgSize();
        return this;
    }

    // This method will set a new height to the chart and update the svg element if exists
    Chart2D.prototype.height = function (h) {
        this.setChartH(h);

        this.getDrawArea().attr("height", h);
        this._update();
        this.updateSvgSize();

        return this;
    }

    // This method will invoke data drawing with the dataset passed in argument
    Chart2D.prototype.dataset = function (d) {
        this.getDrawArea().selectAll("path.graphLine").remove();

        var _this = this;

        // Store new domains
        this.setXMaxDomain( d3.max(d, function (l_data) {
            return d3.max(l_data, _this.getXDataAccessor());
        }) );

        this.setYMaxDomain( d3.max(d, function (l_data) {
            return d3.max(l_data, _this.getYDataAccessor());
        }) );
        
        // Set new domains
        this.getXScale().domain([0, this.getXMaxDomain()]);
        this.getYScale().domain([0, this.getYMaxDomain()]);

        // Update axis
        this.getGraph().select(".axis--x").call(this.getXAxis());
        this.getGraph().select(".axis--y").call(this.getYAxis());


        for ( var i=0; i < d.length; i++ ) {
            this.getDrawArea().selectAll("graphLine")
                                .data([d[i]])
                                .enter()
                                .append('g')
                                .append("path")
                                .transition()
                                .duration(200)
                                .attr("d", this.buildLine)
                                .attr("class", "graphLine")
                                .style("stroke", this.getColorset()[i % 20]);

            _this = this;
            /*this.getDrawArea().selectAll("dot")
                                            .data(d[i])
                                            .enter().append("path") 
                                            .attr("d", this.getSymbol()())
                                            .attr("x", (function (d, i) { return this.getXScale()(this.getXDataAccessor()(d, i)); }).bind(this))
                                            .attr("transform", (function (d, i) { 
                                                var t_x = this.getXScale()(this.getXDataAccessor()(d, i)), t_y = this.getYScale()(this.getYDataAccessor()(d, i));
                                                return "translate(" + t_x + ", " + t_y + ")";
                                            }).bind(this))
                                            .style("fill", this.getColorset()[i % this.getColorset().length])
                                            .style("stroke", this.getColorset()[i % this.getColorset().length])
                                            .style("stroke-opacity", 0)
                                            .style("stroke-width", 5)
                                            .attr("class", "plot")
                                            .on("mouseenter", function () {
                                                for ( var i=0; i < _this.utils.cache.behaviorRst.length; i++ ) {
                                                    if ( _this.utils.cache.behaviorRst[i].node() != this )
                                                        _this.utils.cache.behaviorRst[i].attr("d", _this.getSymbol()()).style("stroke-opacity", 0);
                                                }
                                                _this.utils.cache.behaviorRst = [];
                                                var x_data = _this.getXDataAccessor()(this.__data__), y_data = _this.getYDataAccessor()(this.__data__)
                                                var html = '<b>Tick (' + x_data + ')</b><br />' + y_data + '<br />';
                                                var left = _this.getSvg().node().getBoundingClientRect().left + parseInt(this.getAttribute("x")) - 70;
                                                _this.getTooltip().html(html)   .style("left", left + 'px')
                                                                            .style("top", (d3.event.pageY - 25) + 'px')
                                                                            .style("display", "block");
                                            })
                                            .on("mouseleave", function () {
                                                _this.utils.cache.n_dot = null; // Reset the cached dot to refresh on next mouse event
                                            });*/

            /*this.graphContainer.selectAll("dot")
                                .data(d[i])
                                .enter().append("circle")
                                .attr("r", 2.5)
                                .attr("cx", (function (d, i) { return this.scales.x_scale(this.accessors.x_accessor(d, i)); }).bind(this))
                                .attr("cy", (function (d, i) { return this.scales.y_scale(this.accessors.y_accessor(d, i)); }).bind(this))
                                .attr("fill", this.colorset[i % 20])
                                .attr("stroke", "#fff")
                                .attr("class", "plot")
                                .on("mouseover", function (d) { d3.select(this).transition().duration(200).attr("r", 3); })
                                .on("mouseleave", function (d) { d3.select(this).transition().duration(200).attr("r", 2.5); });*/
        }

        this._dataset = d;

        console.log("Dataset ok, updating svg height");
        this.updateSvgSize();

        return this;
    }
    
    // Accessors
    Chart2D.prototype.getUUID = function () {
        return this.uuid;
    }

    Chart2D.prototype.getPadding = function (orientation) {
        return this.architecture.dimensions.paddings[orientation];
    }

    Chart2D.prototype.getSvgWidth = function () {
        return this.architecture.dimensions.svg.width;
    }

    Chart2D.prototype.getSvgHeight = function () {
        return this.architecture.dimensions.svg.height;
    }
    
    Chart2D.prototype.getChartWidth = function () {
        return this.architecture.dimensions.chart.width;
    }

    Chart2D.prototype.getChartHeight = function () {
        return this.architecture.dimensions.chart.height;
    }

    Chart2D.prototype.getContainer = function () {
        return this.architecture.DOM.container;
    }

    Chart2D.prototype.getSvg = function () {
        return this.architecture.DOM.svg;
    }

    Chart2D.prototype.getSvgPad = function () {
        return this.architecture.DOM.svgPad;
    }

    Chart2D.prototype.getGraph = function () {
        return this.architecture.DOM.graph;
    }

    Chart2D.prototype.getDrawArea = function () {
        return this.architecture.DOM.drawArea;
    }

    Chart2D.prototype.getXScale = function () {
        return this.utils.scales.x_scale;
    }

    Chart2D.prototype.getYScale = function () {
        return this.utils.scales.y_scale;
    }

    Chart2D.prototype.getXAxis = function () {
        return this.utils.axes.x_axis;
    }

    Chart2D.prototype.getYAxis = function () {
        return this.utils.axes.y_axis;
    }

    Chart2D.prototype.getXAxisTxt = function () {
        return this.utils.accessors.x_axis_txt;
    }

    Chart2D.prototype.getYAxisTxt = function () {
        return this.utils.accessors.y_axis_txt;
    }

    Chart2D.prototype.getXDataAccessor = function () {
        return this.utils.accessors.x_data_accessor;
    }

    Chart2D.prototype.getYDataAccessor = function () {
        return this.utils.accessors.y_data_accessor;
    }

    Chart2D.prototype.getTooltip = function () {
        return this.architecture.DOM.tooltip;
    }

    Chart2D.prototype.getColorset = function () {
        return this.utils.colorset;
    }

    Chart2D.prototype.getXMaxDomain = function () {
        return this.utils.x_m_domain;
    }

    Chart2D.prototype.getYMaxDomain = function () {
        return this.utils.y_m_domain;
    }

    Chart2D.prototype.getFollowLine = function () {
        return this.architecture.DOM.followLine;
    }

    // Mutators
    Chart2D.prototype.setPadding = function (object) {
        var keys = Object.keys(object);
        for ( var i=0; i < keys.length; i++ )
            this.architecture.dimensions.paddings[keys[i]] = object[keys[i]];
    }

    Chart2D.prototype.setSvgW = function (w) {
        this.architecture.dimensions.svg.width = w;
    }

    Chart2D.prototype.setSvgH = function (h) {
        this.architecture.dimensions.svg.height = h;
    }
    
    Chart2D.prototype.setChartW = function (w) {
        this.architecture.dimensions.chart.width = w;
    }

    Chart2D.prototype.setChartH = function (h) {
        this.architecture.dimensions.chart.height = h;
    }

    Chart2D.prototype.setContainer = function (container) {
        this.architecture.DOM.container = container;
    }

    Chart2D.prototype.setSvg = function (svg) {
        this.architecture.DOM.svg = svg;
    }

    Chart2D.prototype.setSvgPad = function (svgPad) {
        this.architecture.DOM.svgPad = svgPad;
    }

    Chart2D.prototype.setGraph = function (graph) {
        this.architecture.DOM.graph = graph;
    }

    Chart2D.prototype.setDrawArea = function (drawArea) {
        this.architecture.DOM.drawArea = drawArea;
    }

    Chart2D.prototype.setXScale = function (scale) {
        this.utils.scales.x_scale = scale;
    }

    Chart2D.prototype.setYScale = function (scale) {
        this.utils.scales.y_scale = scale;
    }

    Chart2D.prototype.setXAxis = function (axis) {
        this.utils.axes.x_axis = axis;
    }

    Chart2D.prototype.setYAxis = function (axis) {
        this.utils.axes.y_axis = axis;
    }

    Chart2D.prototype.setXAxisTxt = function (accessor) {
        this.utils.accessors.x_axis_txt = accessor;
    }

    Chart2D.prototype.setYAxisTxt = function (accessor) {
        this.utils.accessors.y_axis_txt = accessor;
    }

    Chart2D.prototype.setXDataAccessor = function (accessor) {
        this.utils.accessors.x_data_accessor = accessor;
        this.buildLine.x( (function (d, i) { return this.getXScale()(this.getXDataAccessor()(d, i)); }).bind(this) );
    }

    Chart2D.prototype.setYDataAccessor = function (accessor) {
        this.utils.accessors.y_data_accessor = accessor;
        this.buildLine.y( (function (d, i) { return this.getYScale()(this.getYDataAccessor()(d, i)); }).bind(this) );
    }    

    Chart2D.prototype.setTooltip = function (style) {
        if ( this.architecture.DOM.tooltip ) {
            this.architecture.DOM.tooltip.style(style);
            return;
        }

        this.architecture.DOM.tooltip = d3.select("body").append('div').style("display", "none").style("position", "absolute").style("pointer-events", "none");
        var k_style = Object.keys(style);
        for ( var i=0; i < k_style.length; i++ )
            this.architecture.DOM.tooltip.style(k_style[i], style[k_style[i]]);
    }

    Chart2D.prototype.setColorset = function (set) {
        this.utils.colorset = set;
    }
    
    Chart2D.prototype.setXMaxDomain = function (v) {
        this.utils.x_m_domain = v;
    }

    Chart2D.prototype.setYMaxDomain = function (v) {
        this.utils.y_m_domain = v;
    }

    Chart2D.prototype.setFollowLine = function (line) {
        this.architecture.DOM.followLine = line;
    }

    // Create chart will generate an instance of the defined chart and return it
    visual_charts.createChart = function (c_type) {

        if ( typeof c_type !== 'string' ) return false;

        if ( c_type == "2DLine" )
            return new Chart2D();
    }

    visual_charts.eventHandlers.hoverRectMouseMove = function () {

        var _this = visualcharts.focus;

        var m_x = d3.mouse(this)[0], m_y = d3.mouse(this)[1];
        console.log("x value for mouse position: ", _this.getXScale().invert(m_x));
        
        // Search x value in series
        var needle = _this.getXScale().invert(m_x);
        var bisect = d3.bisector(function (d) { return _this.getXDataAccessor()(d); }).right;
        _this.getDrawArea().selectAll(".graphLine").each(function (d) {
            var idx = bisect(d, needle) - 1;
            if ( idx < 0 ) return 0;
            console.log("idx: ", idx);
            console.log("Circle at ", _this.getXScale()(_this.getXDataAccessor()(d[idx])), ":", _this.getYScale()(_this.getYDataAccessor()(d[idx])));
            _this.getGraph().select(".dot").style("display", "block").attr("cx", _this.getXScale()(_this.getXDataAccessor()(d[idx]))).attr("cy", _this.getYScale()(_this.getYDataAccessor()(d[idx])));
        });

        _this.getFollowLine().attr("x1", m_x).attr("x2", m_x);
    }

    visual_charts.guid =  function() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }

    return visual_charts;
})() ;

// Extern functions
function getRandomArbitrary(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

var getDataset = function (from, n, min, max) {
    if ( from > n )
        return [];

    var max_scale = 10;
    var min_scale = 7;
    var d = [];
    var n_range = [min, min_scale];
    for ( var i = from; i < n; i++ ) {
        d.push([i, getRandomArbitrary(n_range[0], n_range[1])]);  
        n_range[1] += max_scale;
        n_range[0] += min_scale;
    }
    return d
}