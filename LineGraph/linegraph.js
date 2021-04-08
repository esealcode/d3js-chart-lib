String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

var bytesToString = function (bytes) {
    // One way to write it, not the prettiest way to write it.

    var fmt = d3.format('.1f');
    if (bytes < 1024) {
        return fmt(bytes) + 'B/s';
    } else if (bytes < 1024 * 1024) {
        return fmt(bytes / 1024) + 'kB/s';
    } else if (bytes < 1024 * 1024 * 1024) {
        return fmt(bytes / 1024 / 1024) + 'MB/s';
    } else {
        return fmt(bytes / 1024 / 1024 / 1024) + 'GB/s';
    }
}

function getRandomArbitrary(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

var getDataset = function (from, n, min, max) {
    if ( from > n )
        return [];

    d = [];
    for ( var i = from; i < n; i += 2 ) {
        d.push([i, getRandomArbitrary(max, min)]);  
    }
    return d
}

// The library
window.visualcharts = (function () {
    'use strict';

    function LineGraph() {
        // Options
        this.padding = {top: 30, right: 20, bottom: 30, left: 70};
        this.dimensions = {svg_width: null, svg_height: null, ctx_width: null, ctx_height: null};

        // Containers
        this.svgContainer = null // (typeof __container__ != 'object') ? document.getElementById(__container__.replace('#', '')) : __container__;
        this.svg = null;
        this.svgPad = null; // This one will be the one used for all future draw

        // Clip cut 
        this.clip = null;

        // Graph item
        this.graphContainer = null;
        this.graphYAxis = null;
        this.graphXAxis = null;

        // Hover item
        this.hoverEvent = null;

        // Context items
        this._context = null;

        this.ctxBrush = null;

        this.ctxBrushAccessor = null;

        // Tooltip
        this._tooltip = null;

        // Scales
            // Graph scales
            this.xScale = null;
            this.yScale = null;

            // Context scale
            this.xCtxScale = null;

        // Axes
            // Graph axes
            this.x_axis = null;
            this.y_axis = null;

            // Context axis
            this.x_ctx_axis = null;

        // Line builders
            // Graph line builder
            this.buildLine =  d3.line();

            // Context line builder 
            this.ctxBuildLine = d3.line();
        

        // Texts
        this.debug_txt = null;

        // Labels
        this.x_label = null;


        // Domains limit
        this.xAxis_m_domain = 0;
        this.yAxis_m_domain = 0;

        // Accessors
            // Accessors for axis texts
            this.y_axis_txt = null;
            this.x_axis_txt = null;

            // ...
            this.x_accessor = null;
            this.y_accessor = null;



        this.colorset = null;
        // Tracks
        this.bound = false;
    }

    // This method will bind the chart by filling the element passed as argument with a fresh svg element
    LineGraph.prototype.bind = function (e) {
        if ( this.svgContainer != null ) { // The graph was already binded to another element, we need to remove it
            this.svgContainer.remove();

            // Taking off references
            this.svgContainer = null;
            this.svg = null;
            this.svgPad = null;
            this.graphContainer = null;
            this.graphYAxis = null;
            this.graphXAxis = null;
            this.hoverEvent = null;
            this._context = null;
            this.ctxBrush = null;
        }

        this.svgContainer = (typeof e != 'object') ? document.getElementById(e.replace('#', '')) : e; // The bind actually takes effect here
        if ( this.svgContainer === null )
            return false;

        this.svg = d3.select(this.svgContainer).append('svg');
        this.svg.attr("width", this.padding.left + this.dimensions.svg_width);
        this.svg.attr("height", this.padding.top + this.dimensions.svg_height);

        // Each time client mouse enter the area of this charts, it will update the focus variable of VisualCharts to let it handle correctly events for this chart in the future
        this.svgPad = this.svg.append("g").attr("transform", "translate(" + this.padding.left + ", " + this.padding.top + ")").on("mouseenter", (function () { visualcharts.focus = this }).bind(this) );

        this._build();
        return this;
    }

    // This method build/rebuild the base of the foundation of the chart, will probably need to be called just once
    LineGraph.prototype._build = function () {

        // Build graph container
        if ( this.graphContainer == null )
            this.graphContainer = this.svgPad.append("g").attr("class", "graph").on("mouseenter", viewPathRect).on("mouseleave", hidePathRect);

        if ( this.hoverEvent == null )
            this.hoverEvent = this.graphContainer.append("rect").attr("class", "overlay").on("mousemove", hoverRectMouseMove);

        this.hoverEvent.attr("width", this.dimensions.svg_width)
                       .attr("height", this.dimensions.svg_height);

        // Build scales
        this.xScale = d3.scaleLinear()
                        .domain([0, this.xAxis_m_domain])
                        .range([0, this.dimensions.svg_width]);


        this.yScale = d3.scaleLinear()
                        .domain([0, this.yAxis_m_domain])
                        .range([this.dimensions.svg_height, 0]);

        this.xCtxScale = d3 .scaleLinear()
                            .domain([0, this.xAxis_m_domain])
                            .range([0, this.dimensions.ctx_width]);

        this.yCtxScale = d3 .scaleLinear()
                            .domain([0, this.yAxis_m_domain])
                            .range([this.dimensions.ctx_height, 0]);

        // Build axes
        this.x_axis = d3.axisBottom(this.xScale).ticks(10);
        this.y_axis = d3.axisLeft(this.yScale).ticks(3).tickFormat(this.y_axis_txt).tickSize(-this.dimensions.svg_width);
        this.x_ctx_axis = d3.axisBottom(this.xCtxScale).ticks(10);

        // Append the X Axis
        if ( this.graphXAxis == null )
            this.graphXAxis = this.graphContainer .append("g").attr("class", "axis axis--x").attr("transform", "translate(0," + this.dimensions.svg_height + ")");
        this.graphXAxis.call(this.x_axis);
        
        // Append the Y Axis
        if ( this.graphYAxis == null )
            this.graphYAxis = this.graphContainer .append("g").attr("class", "axis axis--y");
        this.graphYAxis.call(this.y_axis);

        return this;

    }

    // This method will set a new width to the chart and update the svg element if exists
    LineGraph.prototype.width = function (w) {
        if ( this.svg )
            this.svg.attr("width", w);
        this.dimensions.svg_width = w;

        // Update scale/axis if defined, implicit: if x_scale is defined then x_axis exists
        if ( this.x_scale ) {
            this.x_scale.range([0, this.dimensions.svg_width]);
            if ( this.bool_x_axis )
                this.graphContainer.selectAll(".axis axis--x").call(this.x_axis);
        }

        return this;
    }

    // This method will set a new height to the chart and update the svg element if exists
    LineGraph.prototype.height = function (h) {
        if ( this.svg )
            this.svg.attr("height", h);
        this.dimensions.svg_height = h;

        // Update scale if defined, implicift: if y_scale is defined then y_axis exists
        if ( this.y_scale ) {
            this.y_scale.range([this.dimensions.svg_height, 0]);
            if ( this.bool_y_axis )
                this.graphContainer.selectAll(".axis axis--y").call(this.y_axis);
        }

        return this;
    }

    // This method will invoke data drawing with the dataset passed in argument
    LineGraph.prototype.dataset = function (d) {
        // Store new domains
        this.xAxis_m_domain = d3.max(d, this.x_accessor);
        this.yAxis_m_domain = d3.max(d, this.y_accessor);
        
        // Set new domains
        this.xScale.domain([0, xAxis_m_domain]);
        this.yScale.domain([0, yAxis_m_domain]);

        if ( this._context ) { // If context is present then we also update scales
            this.xCtxScale.domain([0, xAxis_m_domain]);
            this.yCtxScale.domain([0, yAxis_m_domain]);
        }

        // Update axis
        this.graphContainer.selectAll(".axis--x").call(this.x_axis);
        this.graphContainer.selectAll(".axis--y").call(this.y_axis);

        if ( this._context )
            this.graphContainer.selectAll(".ctxAxis--x").call(this.x_ctx_axis);

        this.graphContainer.selectAll("path.graphLine").transition().duration(200).attr("d", this.buildLine);

        return this;
    }

    // This method take care of defining the context or not
    LineGraph.prototype.context = function (boolean) {
        if ( !this.built ) return this; // This method need variable which need to be initialized by the build() method.

        if ( boolean ) {
            if ( this._context == null ) {
                // Append context
                this._context = this.svgPad  .append("g")
                                            .attr("transform", "translate(0, " + (this.dimensions.svg_height + 30) + ")")
                                            .attr("class", "context");

                this.ctxBrush = this._context.append("g")
                                            .attr("class", "brush");


                // Add the X axis for context
                this._context.append("g")
                            .attr("class", "axis ctxAxis--x")
                            .attr("transform", "translate(0, " + this.dimensions.ctx_width + ")")
                            .call(this.x_ctx_axis);    
            }
        }
        else {
            if ( this._context ) {
                // Remove context
                this._context.remove();
                this.ctxBrush.remove();

                this._context = null;
                this.ctxBrush = null;
            }
        }

        return this;
    }

    // This method deploy a technique to let the developer to define the way to access data for x axis and let the library call the scale method on it
    LineGraph.prototype.xAccessor = function (accessor) {
        this.x_accessor = accessor;
        this.buildLine.x((function (d) { return this.xScale(this.x_accessor(d)); }).bind(this));
        return this;
    }

    // This method deploy a technique to let the developer to define the way to access data for y axis and let the library call the scale method on it
    LineGraph.prototype.yAccessor = function (accessor) {
        this.y_accessor = accessor;
        this.buildLine.y((function (d) { return this.yScale(this.y_accessor(d)); }).bind(this));
        return this;
    }

    // This method take care of defining tooltip or not
    LineGraph.prototype.tooltip = function (boolean) {
        if ( boolean ) {
            if ( this._tooltip == null ) {
                // Append tooltip
                console.log("append tooltip");
                this._tooltip = d3.select("body").append('div').attr('class', 'graph-tooltip');
            }
        }
        else {
            if ( this._tooltip ) {
                // Remove tooltip
                this._tooltip.remove();
                this._tooltip = null;
            }
        }

        return this;
    }

    // This method append new style to a LineGraph item
    LineGraph.prototype.style = function (on, style) {
        switch ( on ) {
            case "tooltip":
                this.tooltip.attr("")
        }
    }

    LineGraph.prototype.tmp = function () {
                // Options
        this.padding = {top: 30, right: 20, bottom: 30, left: 70};
        this.svgWidth = opts.svgWidth;
        this.svgHeight = opts.svgHeight;
        this.ctxWidth = this.svgWidth;
        this.ctxHeight = 30;

        // LineGraph class
        this.svgContainer = (typeof __container__ != 'object') ? document.getElementById(__container__.replace('#', '')) : __container__;
        this.svg = d3   .select(this.svgContainer)
                        .append("svg")
                        .attr("width", this.svgWidth)
                        .attr("height", this.svgHeight);

        this.padSvg = this.svg  .append("g")
                                .attr("transform", "translate(" + this.padding.left + ", " + this.padding.top + ")").on("mouseenter", (function () { VisualCharts.focus = this }).bind(this) );

        // Clip cut 
        this.clip = this.svg.append("defs") 
                            .append("clipPath")
                            .attr("id", "clip")
                            .append("rect")
                            .attr("width", this.svgWidth)
                            .attr("height", this.svgHeight);

        // Graph item
        this.graphContainer = this.svg  .append("g")
                                        .attr("class", "graph")
                                        .on("mouseenter", viewPathRect.bind(this)) // Event callbacks for scatterplots view
                                        .on("mouseleave", hidePathRect.bind(this));

        // Hover item
        this.hoverEvent = this.graphContainer   .append("rect")
                                                .attr("width", this.svgWidth)
                                                .attr("height", this.svgHeight)
                                                .attr("class", "overlay")
                                                .on("mousemove", hoverRectMouseMove.bind(this));

        // Context items
        this.context = this.svg .append("g")
                                .attr("class", "context")
                                .attr("transform", "translate(0, " + (this.svgHeight + 30) + ")");

        this.ctxBrush = this.context.append("g")
                            .attr("class", "brush");

        this.ctxBrushAccessor = d3.brushX().extent([[0, 0], [this.ctxWidth, this.ctxHeight]]).on("brush end", brushing.bind(this));

        // Scales
            // Graph scales
            this.xScale =  d3.scaleLinear().domain([0, 0]).range([0, this.svgWidth]);
            this.yScale = d3.scaleLinear().domain([0, 0]).range([this.svgHeight, 0]);;

            // Context scale
            this.xCtxScale = d3.scaleLinear().domain([0, 0]).range([0, this.ctxWidth]);;

        // Axes
            // Graph axes
            this.xAxis = d3.axisBottom(this.xScale).ticks(10);;
            this.yAxis = d3.axisLeft(this.yScale).ticks(3).tickFormat(bytesToString).tickSize(-width); 

            // Context axis
            this.xCtxAxis = d3.axisBottom(this.xCtxScale).ticks();

        // Line builders
            // Graph line builder
            this.buildLine =  d3.line() .x( (function(d) { return this.xScale(d[0]); }).bind(this) )
                                        .y( (function(d) { return this.yScale(d[1]); }).bind(this) );

            // Context line builder 
            this.ctxBuildLine = d3.line() .x( (function (d) { return this.xCtxScale(d[0]); }).bind(this) )
                                        .y( (function(d) { return this.yCtxScale(d[1]); }).bind(this) );
        

        // Texts
        this.debug_txt = this.graphContainer.append("text")
                                            .attr("transform", "translate(10, 10)")
                                            .attr("class", "debug_txt");

        // Labels
        this.x_label = this.graphContainer  .append("text")
                                            .attr("transform", "translate(" + (this.svgWidth - 30) + ", " + (this.svgHeight - 5) + ")")
                                            .attr("class", "b_text")
                                            .text("Ticks");


        // Domains limit
        this.xAxis_m_domain = 0;
        this.yAxis_m_domain = 0;
    }

    LineGraph.prototype.drawLine = function (dataset, colorset) {
        // Update scales on axis
        dataset.push([this.xAxis_m_domain, this.yAxis_m_domain]); // Put the set of data which contain the current maximum value to be compared with new values
        
        // Store new domains
        this.xAxis_m_domain = d3.max(dataset, function(d) { return d[0]; });
        this.yAxis_m_domain = d3.max(dataset, function(d) { return d[1]; });
        
        // Set new domains
        this.xScale.domain([0, this.xAxis_m_domain]);
        this.yScale.domain([0, this.yAxis_m_domain]);
        this.xCtxScale.domain([0, this.xAxis_m_domain]);
        this.yCtxScale.domain([0, this.yAxis_m_domain]);

        // Update axis
        this.graphContainer.selectAll(".axis--x").call(this.xAxis);
        this.graphContaine.selectAll(".axis--y").call(this.yAxis);
        this.graphContaine.selectAll(".ctxAxis--x").call(this.xCtxAxis);
        
        
        // Remove pushed set of data from new datas
        dataset.pop();


        // Update lines/dot
            this._context.selectAll("path.ctxLine").attr("d", this.ctxBuildLine);
            this.graphContainer .selectAll("path.graphLine").transition().duration(200).attr("d", this.buildLine);
            this.graphContainer .selectAll("._dot")
                                .transition().duration(200)
                                .attr("x", (function (d) { return this.xScale(d[0]) - 2.5; }).bind(this) )
                                .attr("y", (function (d) { return this.yScale(d[1]) - 2.5; }).bind(this) );
        
        // Add the focus wrapper for this line
        this.graphContainer   .append("circle")
                                .attr("class", "d" + l_n + " dot_wrapper")
                                .attr("r", 9)
                                .style("fill", colorset.dot_fill);
        
        this.graphContainer   .append("path")
                                .data([dataset])
                                .style("stroke", colorset.line_stroke)
                                .attr("d", this.buildLine)
                                .attr("class", "graphLine")
                                .on("mouseover", pathHover)
                                .on("mouseleave", pathLeave);

        this._context      .append("path")
                            .data([dataset])
                            .attr("class", "ctxLine")
                            .style("stroke", colorset.line_stroke)
                            .attr("d", this.ctxBuildLine);

        this.graphContainer   .selectAll("dot")
                                .data(dataset)
                                .enter()
                                .append("rect")
                                .attr("width", 5)
                                .attr("height", 5)
                                .attr("x", (function (d) { return this.xScale(d[0]) - 2.5; }).bind(this) )
                                .attr("y", (function (d) { return this.yScale(d[1]) - 2.5; }).bind(this) )
                                .attr("data-boundX", function (d) { return d[0] })
                                .attr("data-boundY", function (d) { return d[1] })
                                .attr("data-boundWrapper", ".d" + l_n)
                                .attr("class", "_dot")
                                .style("fill", colorset.dot_fill)
                                .style("stroke", colorset.dot_stroke)
                                .on("mouseover", dotHover)
                                .on("mouseleave", dotLeave);

            this.ctxBrush.call(this.ctxBrushAccessor);
    }

    var visual_charts = {
        "version": "0.0.1",
        "focus": null
    };

    // Create chart will generate an instance of the defined chart and return it
    visual_charts.createChart = function (c_type) {
        if ( typeof c_type !== 'string' ) return false;

        if ( c_type == "line" )
            return new LineGraph();
    }

    return visual_charts;
})();

console.log("Execute...");

l_n = 0;
xAxis_m_domain = 0, yAxis_m_domain = 0;

// Set the dimensions of the canvas / graph
var padding = {top: 30, right: 20, bottom: 30, left: 70},
    width = 1300,
    height = 270,
    ctxWidth = width, ctxHeight = 30;

// Set the ranges
console.log("Width: ", width, ", Height: ", height);
var xScale = d3 .scaleLinear()
                .domain([0, 0])
                .range([0, width]);

var yScale = d3 .scaleLinear()
                .domain([0, 0])
                .range([height, 0]);

var xCtxScale = d3  .scaleLinear()
                    .domain([0, 0])
                    .range([0, ctxWidth]);

var yCtxScale = d3  .scaleLinear()
                    .domain([0, 0])
                    .range([ctxHeight, 0]);

// Define the axes
var xAxis = d3.axisBottom(xScale).ticks(10);

var yAxis = d3.axisLeft(yScale).ticks(3).tickFormat(bytesToString).tickSize(-width);

var xCtxAxis = d3.axisBottom(xCtxScale).ticks();

var ctxBrush = d3.brushX().extent([[0, 0], [ctxWidth, ctxHeight]]).on("brush end", brushing);

// Define the line accessor
var buildLine = d3  .line()
                    .x(function(d) { return xScale(d[0]); })
                    .y(function(d) { return yScale(d[1]); });

var ctxBuildLine = d3   .line()
                        .x(function (d) { return xCtxScale(d[0]); })
                        .y(function(d) { return yCtxScale(d[1]); });

    
// Adds the svg canvas
var svg = d3.select("body")
            .append("svg")
            .attr("width", width )
            .attr("height", height + padding.top + padding.bottom + ctxHeight + 30);

var _svg = svg;

svg.append("defs")  .append("clipPath")
                    .attr("id", "clip")
                    .append("rect")
                    .attr("width", width)
                    .attr("height", height);

svg = svg.append("g")
         .attr("transform", "translate(" + padding.left + "," + padding.top + ")");

var tooltip = d3.select('body').append('div').attr('class', 'graph-tooltip');

var container = svg .append("g")
                    .attr("class", "graph")
                    .on("mouseenter", viewPathRect)
                    .on("mouseleave", hidePathRect);

var context = svg   .append("g")
                    .attr("transform", "translate(0, " + (height + 30) + ")")
                    .attr("class", "context");

var ctxBrushDOM = context   .append("g")
                            .attr("class", "brush");

var hover_rect = container.append("rect")
                          .attr("width", width)
                          .attr("height", height)
                          .attr("class", "overlay")
                          .on("mousemove", hoverRectMouseMove);

// Add the X Axis
container   .append("g")
            .attr("class", "axis axis--x")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

// Add the Y Axis
container   .append("g")
            .attr("class", "axis axis--y")
            .call(yAxis);

// Add the X axis for context
context .append("g")
        .attr("class", "axis ctxAxis--x")
        .attr("transform", "translate(0, " + ctxHeight + ")")
        .call(xCtxAxis);

// Keep the reference for future updates
var d_info_txt = container  .append("text")
                            .attr("y", 10)
                            .attr("x", 10)
                            .attr("class", "debug_txt");

// Labels
container.append("text").attr("y", height - 5).attr("x", width - 30).attr("class", "b_text").text("Ticks");


function brushing() {
    console.log("Selection: ", d3.event.selection);
    console.log("extent: ", ctxBrush.extent()());
    //xScale.domain(d3.event.selection == null ? xScale.domain() : [ctxBrush.extent()()[0][0], ctxBrush.extent()()[1][0]]);
    console.log(d3.event.selection)
    console.log(xCtxScale.range());
    var s = d3.event.selection || xCtxScale.range();
    xScale.domain(s.map(xCtxScale.invert, xCtxScale));
    console.log("New domain: ", xScale.domain());

    // Update lines/dot 
    container .selectAll("path.graphLine").attr("d", buildLine);
    container .selectAll("._dot")
                .attr("x", function (d) { return xScale(d[0]) - 2.5; })
                .attr("y", function (d) { return yScale(d[1]) - 2.5; });

    // Update axis
    d3.selectAll(".axis--x").call(xAxis);
    d3.selectAll(".axis--y").call(yAxis);
}

function viewPathRect() {
  container.selectAll("._dot").style("display", "block"); 
}

function hidePathRect() {
   container.selectAll("._dot").style("display", "none");
 
   container.selectAll(".dot_wrapper").style("display", "none");
  
   var node = tooltip.node();
   setTimeout(function () {
     node.style.display = "none";
   }, 15);
}

function hoverRectMouseMove() {
  var m_x = d3.mouse(this)[0], m_y = d3.mouse(this)[1];
  
  var nearest_d = nearestDot(d3.mouse(this));
  var n_x = parseInt(nearest_d.getAttribute('x')),
      n_y = parseInt(nearest_d.getAttribute('y'));
  
  var focus_data = []
  
  d3.selectAll("._dot").each(function () {
     if ( parseInt(this.getAttribute('x')) == n_x ) {
         focus_data.push({'x_axis': this.dataset.boundX, 'y_axis': this.dataset.boundY });
         container.select(this.dataset.boundWrapper)
                  .style("display", "block")
                  .transition()
                  .duration(50)
                  .attr("cx", parseInt(this.getAttribute('x')) + 3)
                  .attr("cy", parseInt(this.getAttribute('y')) + 3);
     }
  });
  
  focus_data.sort(function (a, b) {
    return b.y_axis - a.y_axis;
  })
  
  var html = '<b>Tick (' + focus_data[0].x_axis + ')</b><br />',
      text = 'Tick (' + focus_data[0].x_axis + ') : ';
  for ( var i=0; i < focus_data.length; i++ ) {
      html += bytesToString(focus_data[i].y_axis) + '<br />';
      text += bytesToString(focus_data[i].y_axis) + ', ';
  }
  
  var svgBound = _svg.node().getBoundingClientRect();
  //console.log(n_x);
  //console.log("svg container X: ", svgBound.left, ", computed tooltip left: ", (d3.event.pageX + n_x - 70));
  var left = (svgBound.left + n_x - 70) < svgBound.left ? (svgBound.left + 100) : (svgBound.left + n_x - 70);
  
  tooltip.html(html).transition()		
                    .duration(50)
                    .style("left", left + 'px')
                    .style("top", (d3.event.pageY - 25) + 'px')
                    .style("display", "block");
  
  //console.log(text);
  d_info_txt.text(text);
}

function nearestDot(m_p) {
    var c_x = m_p[0]; // Get X position of cursor
    var nearest = undefined;
    var n_value = 0;
    var i = 0;
    d3.selectAll("._dot").each(function () {
        //console.log("n_value to beat: ", n_value);
        dot_x = parseInt(this.getAttribute("x"));
        if ( i++ == 0 ) {
          nearest = this;
          n_value = Math.abs(c_x - dot_x);
          return;
        }
      
        if ( Math.abs(c_x - dot_x) < n_value ) {
           //console.log("New beat: Math.abs(c_x - dot_x) -> +(", c_x, " - ", dot_x, ") == ", Math.abs(c_x - dot_x));
           nearest = this;
           n_value = Math.abs(c_x - dot_x);
        }
      
    });
  
    return nearest;
}

function pathHover(d, i) {
  s_this = this;
  this.style.strokeWidth = 3;
  
  container.selectAll("path.graphLine").each(function () {
  if ( this != s_this )
        this.style.opacity = "0.3";
  });
  
  container.selectAll("._dot").style("opacity", 0.3);
}

function pathLeave(d, i) {
  container.selectAll("path.graphLine").style("opacity", "");
  
  container.selectAll("._dot").style("opacity", ""); 
  
  this.style.strokeWidth = 2;
}

function dotHover(d, i) {
  s_this = this;
  
  tooltip.style("display", "none");
  
  container .select(this.dataset.boundWrapper)
            .attr("cx", xScale(d[0]))
            .attr("cy", yScale(d[1]))
            .style("display", "block");
  
  container.selectAll('._dot').each(function () {
     if ( this == s_this ) return;
     d3.select(this).style("opacity", 0.3);
  });
  
  container.selectAll('path.graphLine').style("opacity", 0.3);
  
  console.log("Data here");
  d_info_txt.text(bytesToString(d[1]));
}

function dotLeave(d, i) {
  container .select(this.dataset.boundWrapper)
            .attr("cx", xScale(d[0]))
            .attr("cy", yScale(d[1]))
            .style("display", "none");
  
    container.selectAll('._dot').style("opacity", 1);
  
  container.selectAll('path.graphLine').style("opacity", 1);
  
   d_info_txt.text(''); 
}

function newLine(dataset, colorset) {
  console.log("newLine...");
  // Update scales on axis
  dataset.push([xAxis_m_domain, yAxis_m_domain]); // Put the set of data which contain the current maximum value to be compared with new values
  
  // Store new domains
  xAxis_m_domain = d3.max(dataset, function(d) { return d[0]; });
  yAxis_m_domain = d3.max(dataset, function(d) { return d[1]; });
  
  // Set new domains
  xScale.domain([0, xAxis_m_domain]);
  yScale.domain([0, yAxis_m_domain]);
  xCtxScale.domain([0, xAxis_m_domain]);
  yCtxScale.domain([0, yAxis_m_domain]);

  // Update axis
  d3.selectAll(".axis--x").call(xAxis);
  d3.selectAll(".axis--y").call(yAxis);
  d3.selectAll(".ctxAxis--x").call(xCtxAxis);
  
  
  // Remove pushed set of data from new datas
  dataset.pop();


  // Update lines/dot
    context.selectAll("path.ctxLine").attr("d", ctxBuildLine);
    container.selectAll("path.graphLine").transition().duration(200).attr("d", buildLine);
    container.selectAll("._dot")
             .transition().duration(200)
             .attr("x", function (d) { return xScale(d[0]) - 2.5; })
             .attr("y", function (d) { return yScale(d[1]) - 2.5; })
  
  // Add the focus wrapper for this line
  container .append("circle")
            .attr("class", "d" + l_n + " dot_wrapper")
            .attr("r", 9)
            .style("fill", colorset.dot_fill);
 
  container .append("path")
            .data([dataset])
            .style("stroke", colorset.line_stroke)
            .attr("d", buildLine)
            .attr("class", "graphLine")
            .on("mouseover", pathHover)
            .on("mouseleave", pathLeave);

  context   .append("path")
            .data([dataset])
            .attr("class", "ctxLine")
            .style("stroke", colorset.line_stroke)
            .attr("d", ctxBuildLine(dataset));

  container .selectAll("dot")
            .data(dataset)
            .enter()
            .append("rect")
            .attr("width", 5)
            .attr("height", 5)
            .attr("x", function (d) { return xScale(d[0]) - 2.5; })
            .attr("y", function (d) { return yScale(d[1]) - 2.5; })
            .attr("data-boundX", function (d) { return d[0] })
            .attr("data-boundY", function (d) { return d[1] })
            .attr("data-boundWrapper", ".d" + l_n)
            .attr("class", "_dot")
            .style("fill", colorset.dot_fill)
            .style("stroke", colorset.dot_stroke)
            .on("mouseover", dotHover)
            .on("mouseleave", dotLeave);

    ctxBrushDOM.call(ctxBrush);
    l_n++; // Increment l_n for future addition
}

// Dynamically update graph
newLine(getDataset(0, 100, 0, 3000000), {
  "line_stroke": "#A3BDE9",
  "dot_fill": "#6581AC",
  "dot_stroke": "6581AC"
});

setTimeout(function () {
  newLine(getDataset(0, 100, 1500000, 5000000), {
    "line_stroke": "#F6BB55",
    "dot_fill": "#DCA33F",
    "dot_stroke": "#D09530"
  });
}, 5000);

setTimeout(function () {
  newLine(getDataset(50, 100, 5000000, 7000000), {
    "line_stroke": "#73B284",
    "dot_fill": "#4A964A",
    "dot_stroke": "6581AC"
  });
}, 10000);