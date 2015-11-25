
var _data;
var dateFormat = d3.time.format('%Y%m%d')
var display_dateFormat = d3.time.format('%Y-%m-%d')
var date_domain = {}
var quad = ['Verbal Cooperation', 'Material Cooperation', 'Verbal Conflict', 'Material Conflict']


function dim_zero_rows(chart) {
  chart.selectAll('text.row').classed('dim',function(d){return (d.value < 0.1)});
}


document.getElementById("filter").onkeyup = function(e) {
  text = e?e.target.value.toUpperCase():'';
  filter_dim.filter(function(d){ 
    return d.toUpperCase().indexOf(text) > -1;
  })
  dc.redrawAll();
}

var resetSearch = function(searchBox){
  d3.select("#" + searchBox + "_reset").classed({hidden:true})
  document.getElementById(searchBox).value = ""
}

var resetAllSearch = function(){
  d3.selectAll('.fa-times').classed({hidden:true});
  d3.selectAll('input').each(function(){this.value=''; this.onkeyup()});
}

generateSearchbox = function(dimension,filterName) {
  document.getElementById(filterName).onkeyup = function(e) 
  {
    text = e?e.target.value.toUpperCase():'';
    d3.select("#"+filterName+"_reset").classed({hidden:function(){return text===''}});  
    dimension.filterFunction(function(d){
      return d.toUpperCase().indexOf(text) > -1;
    })
    dc.redrawAll()
  }
}


function cleanup(d) {
  d.date_added = dateFormat.parse(d.DATEADDED);
  d.event_date = dateFormat.parse(d.SQLDATE);
  d.Actor1Name = d.Actor1Name || 'N/A'
  d.Actor2Name = d.Actor2Name || 'N/A'
  date_domain.min = date_domain.min || d.date_added;
  date_domain.max = date_domain.max || d.date_added;
  d.lat = +d.ActionGeo_Lat;
  d.long = +d.ActionGeo_Long;
  d.AvgTone = +d.AvgTone // its a number!
  if (d.AvgTone > 6) {
    d.tone = 'Great'
  } else if (d.AvgTone > 2) {
    d.tone = 'Good'
  } else if (d.AvgTone < -6) {
    d.tone = 'Awful'
  } else if (d.AvgTone < -2) {
    d.tone = 'Bad'
  } else {
    d.tone = 'Neutral'
  }

  d.date_bin = d3.time.week.floor(d.date_added)
  
  
  if (d.date_added < date_domain.min) {
      date_domain.min = d.date_added;
  }
  
  if (d.date_added > date_domain.max) {
      date_domain.max = d.date_added;
  }
  d.ActionGeo_FullName = d.ActionGeo_FullName.replace(', New Zealand (general)','')
  d.ActionGeo_FullName = d.ActionGeo_FullName.replace(', New Zealand','')
  splited = d.ActionGeo_FullName.split(',')
  if (splited.length > 1 && splited[0].toUpperCase().trim() == splited[1].toUpperCase().trim()) {
    d.ActionGeo_FullName = splited[0];
  }
}

var dict = {
  'Others':'Others'
}

function add_dict(d) {
  dict[d.CAMEOEVENTCODE] = d.EVENTDESCRIPTION.replace(', not specified below','').trim();
}

queue()
    .defer(d3.tsv, "data/nz_header.tsv")
    .defer(d3.tsv, "dict/CAMEO.eventcodes.tsv")
    .await(showCharts);

function showCharts(err, data, event_dict) {
  _event_dict = event_dict;
  for (i in event_dict) {
    add_dict(event_dict[i]);
  }
  
  _data = data;
  for (i in data) {
    cleanup(data[i]);
  }
  
  ndx = crossfilter(_data);
  
  filter_dim = ndx.dimension(function(d) {return d.SOURCEURL});

  date_domain.min = d3.time.day.offset(date_domain.min, -1)
  date_domain.max = d3.time.day.offset(date_domain.max, +1)
  
  function date_init() {
    return {
      Awful:0,
      Bad:0,
      Neutral:0,
      Good:0,
      Great:0
      
    }
  }
  
  function date_add(p,v) {
    p[v.tone] = (p[v.tone] || 0)+1
    return p;
  }
  
  function date_sub(p,v) {
    p[v.tone] -= 1
    return p;
  }
// ---------------------------- count of records -----------------------------
  
  dc.dataCount(".dc-data-count")
    .dimension(ndx)
    .group(ndx.groupAll());  
  
  // ------------------------------ charts ----------------------------------- 
  date = ndx.dimension(function(d) { return d.date_bin});
  
  date_group = date.group().reduce(date_add,date_sub,date_init);

  function colors(d) {
    if (d=='Awful') {
      return '#e6550d'
    } 
    if (d=='Bad') {
      return '#fd8d3c'
    }
    if (d=='Neutral') {
      return '#ddd'
    }
    if (d=='Good') {
      return '#6baed6'
    }
    if (d=='Great') {
      return '#3182bd'
    }
  }
  
  date_chart = dc.barChart('#date')
    .height(200)
    .dimension(date)
    .group(date_group, 'Awful').valueAccessor(function(d){return d.value.Awful})
    .stack(date_group, 'Bad', function(d){return d.value.Bad})
    .stack(date_group, 'Neutral', function(d){return d.value.Neutral})
    .stack(date_group, 'Good', function(d){return d.value.Good})
    .stack(date_group, 'Great', function(d){return d.value.Great})
    .elasticY(true)
    .colors(colors)
    .x(d3.time.scale().domain([date_domain.min, date_domain.max])) 
    .xUnits(d3.time.weeks)
    .centerBar(true)
    .renderHorizontalGridLines(true)
    .renderVerticalGridLines(true)
    .transitionDuration(200)
   
  date_chart.yAxis().ticks(4).tickFormat(d3.format('s'));
  
  Actor1Name = ndx.dimension(function(d) { return d.Actor1Name});
  Actor1Name_ = ndx.dimension(function(d) { return d.Actor1Name})
  
  generateSearchbox(Actor1Name_,'Actor1Filter')
  
  Actor1Name_group = Actor1Name.group().reduceCount();
  Actor1Name_chart = dc.rowChart('#Actor1Name')
    .dimension(Actor1Name)
    .group(Actor1Name_group)
    .transitionDuration(200)
    .height(400)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    .cap(25)
  Actor1Name_chart.xAxis().ticks(4).tickFormat(d3.format('s'));
  Actor1Name_chart.on('pretransition.dim', dim_zero_rows)

  EventCode = ndx.dimension(function(d) { return d.EventCode});
  EventCode_ = ndx.dimension(function(d) { return d.EventCode})
  
//generateSearchbox(EventCode_,'EventFilter')
  
  document.getElementById('EventFilter').onkeyup = function(e) 
  {
    text = e?e.target.value.toUpperCase():'';
    d3.select("#EventFilter_reset").classed({hidden:function(){return text===''}});  
    EventCode_.filterFunction(function(d){
      return dict[d].toUpperCase().indexOf(text) > -1;
    })
    dc.redrawAll()
  }
  
  EventCode_group = EventCode.group().reduceCount();
  EventCode_chart = dc.rowChart('#EventCode')
    .dimension(EventCode)
    .group(EventCode_group)
    .transitionDuration(200)
    .height(400)
    .label(function(d){return dict[d.key]})
    .title(function(d){return dict[d.key] + ":" + d.value})
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    .cap(25)
  EventCode_chart.xAxis().ticks(4).tickFormat(d3.format('s'));
  EventCode_chart.on('pretransition.dim', dim_zero_rows)
  
  
  Actor2Name = ndx.dimension(function(d) { return d.Actor2Name});
  
  Actor2Name_ = ndx.dimension(function(d) { return d.Actor2Name})
  
 generateSearchbox(Actor2Name_,'Actor2Filter')
  
  Actor2Name_group = Actor2Name.group().reduceCount();
  Actor2Name_chart = dc.rowChart('#Actor2Name')
    .dimension(Actor2Name)
    .group(Actor2Name_group)
    .transitionDuration(200)
    .height(400)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    .cap(25)
  Actor2Name_chart.xAxis().ticks(4).tickFormat(d3.format('s'));
  Actor2Name_chart.on('pretransition.dim', dim_zero_rows)


  
  ActionGeo_FullName = ndx.dimension(function(d) { return d.ActionGeo_FullName});
  ActionGeo_FullName_ = ndx.dimension(function(d) { return d.ActionGeo_FullName})
  
  generateSearchbox(ActionGeo_FullName_,'GeoFilter')
    
  ActionGeo_FullName_group = ActionGeo_FullName.group().reduceCount();
  ActionGeo_FullName_chart = dc.rowChart('#ActionGeo_FullName')
    .dimension(ActionGeo_FullName)
    .group(ActionGeo_FullName_group)
    .transitionDuration(200)
    .height(400)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    .cap(25)
  ActionGeo_FullName_chart.xAxis().ticks(4).tickFormat(d3.format('s'));
  ActionGeo_FullName_chart.on('pretransition.dim', dim_zero_rows)

  
  tone = ndx.dimension(function(d) { return d.tone});
  tone_group = tone.group().reduceCount();
  tone_chart = dc.pieChart('#tone')
    .innerRadius(50)
    .radius(80)
    .dimension(tone)
    .colors(colors)
    .group(tone_group)
    .transitionDuration(200)
    .height(200)
  
  QuadClass = ndx.dimension(function(d) { return d.QuadClass});
  QuadClass_group = QuadClass.group().reduceCount();
  QuadClass_chart = dc.pieChart('#QuadClass')
    .innerRadius(50)
    .radius(80)
    .dimension(QuadClass)
    .group(QuadClass_group)
    .label(function(d){return quad[d.key-1]})
    .title(function(d){return quad[d.key-1] + ":" + d.value})
    .transitionDuration(200)
    .height(200)
  
  
  fakeDim = {
    top: function(x) {
      var our_data = date.top(100);
      
      var nest = d3.nest()
        .key(function(d){return display_dateFormat(d.date)})
        .key(function(d){return d.url})
        .rollup(function(leaves) { return _.uniq(_.map(leaves, function(d){ return d.marker}), false, function(d){ return JSON.stringify([d.lat,d.long])});})
        .entries(_.map(our_data,function(d){return {date:d.date_added, url:d.SOURCEURL,marker:{lat:d.lat,long:d.long, named:d.ActionGeo_FullName}}}));
      
      results = [];
      for (i in nest) {
        for (j in nest[i].values) {
          results.push({
            date:nest[i].key,
            url:nest[i].values[j].key,
            markers:nest[i].values[j].values
          })
        }
      }
      return results.slice(0,10);
    }
  }
  
//    generateSearchbox(fakeDim,'filter')
  
  dc.dataTable("#dc-table-graph")
    .dimension(fakeDim)
    .group(function(d) { return d.date})
    .size(20)
    .columns([
      function(d) { return '<a href=\"' + d.url + '" target="_blank">' + d.url+ '</a>' },
//      function(d) { return '<a href=\"http://maps.google.com/maps?q=' + d.lat + '+' + d.long +"\" target=\"_blank\">Google Map</a>"},
    ])
    .order(d3.descending)
    
  dc.renderAll();

 
  
}
