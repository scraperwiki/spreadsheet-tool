// sqliteEndpoint = "../../sqlite";
sqliteEndpoint = "https://box.scraperwiki.com/DragonDave.canada-temperature/sqlite";

function sqlite(args){
    var options = {
        columns: "*",
        table: "sqlite_master WHERE (type='table' OR type='view') AND name NOT LIKE '#_%'  ESCAPE '#'",
        limit: 50,
        offset: 0,
        orderby: null
    }
    $.extend(true, options, args);
    return $.ajax({
        url: sqliteEndpoint,
        dataType: 'json',
        cache: false,
        data: {
            q: 'SELECT ' + options.columns + ' FROM ' + options.table + ( options.orderby ? ' ORDER BY ' + options.orderby : '' ) + ' LIMIT ' + options.limit + ' OFFSET ' + options.offset
        }
    });
}

function showSlickGrid(table_name){
    sqlite({
        table: table_name
    }).done(function(data){
        var grid;
        var options = {
            enableColumnReorder: true,
            enableTextSelectionOnCells: true
        }
        // create column definitions from first row of data
        var columns = [];
        var names = [];
        for(var key in data[0]){
            columns.push({
                id: key,
                name: key,
                field: key,
                sortable: true
            });
            names.push(key);
        }

        var key = [location.pathname, 'columns', table_name]
        var storedColumns = store.get(JSON.stringify(key));
        var storedNames = [];
        if(storedColumns){
            $.each(storedColumns, function(i, col){
                storedNames.push(col.name);
            });
            names.sort();
            storedNames.sort();
            if(String(names) == String(storedNames)){
                columns = storedColumns;
            }
        }

        // create the table
        grid = new Slick.Grid("#datagrid", data, columns, options);
        var ordercolumn = null;
        var orderdirection = null;

        // handle sorting of data
        grid.onSort.subscribe(function(e, args){
            grid.scrollRowIntoView(0);
            ordercolumn = args.sortCol.field;
            orderdirection = args.sortAsc;
            sqlite({
                table: table_name,
                orderby: ordercolumn + ' ' + (orderdirection ? 'asc' : 'desc')
            }).done(function(newdata){
                data = newdata;
                grid.setData(data);
                grid.updateRowCount();
                grid.render();
            });
        });

        // infinite scrolling
        var loading = false;
        var allDataLoaded = false;
        var rowsToGet = 100;
        grid.onViewportChanged.subscribe(function (e, args) {
            if(!loading && !allDataLoaded && grid.getViewport().bottom + 20 > grid.getDataLength()){
                loading = true;
                var sqlite_options = {
                    table: table_name,
                    limit: rowsToGet,
                    offset: grid.getDataLength()
                }
                if(ordercolumn && orderdirection){
                    sqlite_options['orderby'] = ordercolumn + ' ' + (orderdirection ? 'asc' : 'desc');
                }
                sqlite(sqlite_options).done(function(newdata){
                    $.each(newdata, function(i,row){
                        data.push(row);
                    });
                    grid.updateRowCount();
                    grid.render();
                    loading = false;
                    if(newdata.length < rowsToGet){
                        allDataLoaded = true;
                    }
                });
            }
        });

        function saveColumnInfo(e, args){
            var key = [location.pathname, 'columns', table_name];
            store.set(JSON.stringify(key), args.grid.getColumns())
        }

        grid.onColumnsReordered.subscribe(saveColumnInfo);
        grid.onColumnsResized.subscribe(saveColumnInfo);

    });
}

$(function(){

    sqlite().done(function(tables){
        if(tables.length == 0){
            $('<div>').addClass('alert').html('<button type="button" class="close" data-dismiss="alert">×</button> <strong>Your dataset is empty!</strong> We connected to your dataset fine, but couldn&rsquo;t find any data. Is it empty?').appendTo('body');
        } else {
            var key = [location.pathname, 'tab'];
            var storedTableName = store.get(JSON.stringify(key));
            var name = storedTableName || tables[0]['name'];

            var $ul = $('<ul>').addClass('nav nav-tabs');
            $.each(tables, function(i, table){
                $('<li' + ( table['name'] == name ? ' class="active"' : '' ) + '>').append('<a href="#">' + table['name'] + '</a>').bind('click', function(e){
                    e.preventDefault();
                    $(this).addClass('active').siblings('.active').removeClass('active');
                    showSlickGrid($(this).text());
                    var key = [location.pathname, 'tab'];
                    store.set(JSON.stringify(key), $(this).text());
                }).appendTo($ul);
            });
            $ul.appendTo('body');
            $('<div id="datagrid">').appendTo('body');

            showSlickGrid(name);
        }
    }).fail(function(jqXHR, textStatus, errorThrown){
        if(jqXHR.status == 403){
            var html = '<strong>Forbidden access to your dataset API</strong> We received a 403 Forbidden status while reading your dataset. Does your box have a publish_token we don&rsquo;t know about?'
        } else {
            var html = '<strong>Unexpected response from dataset API</strong> ' + $.trim(jqXHR.responseText)
        }
        $('<div>').addClass('alert alert-error').html('<button type="button" class="close" data-dismiss="alert">×</button> ' + html).appendTo('body');
    });

});
