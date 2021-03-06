/**
 *	Rameses UI library
 *	depends: rameses-extension library
 */

var R = {
	DEBUG: false,
	PREFIX: 'r',
	attr: function(elm, attr, value) {
		attr = this.PREFIX + ':' + attr;
		try {
			if( value )
				return elm.jquery? elm.attr(attr, value) : $(elm).attr(attr, value);
			else
				return elm.jquery? elm.attr(attr) : $(elm).attr(attr);
		}
		catch(e) {
			if( window.console && R.DEBUG ) console.log( e.message );
			return null;
		}
	}
};

var BindingUtils = new function() {
    //loads all controls and binds it to the context object

    this.handlers = {};
    this.loaders = [];
    this.input_attributes = [];
		
	var controlLoader =  function(idx, elem, force) {
		var $e = $(elem);	
		var contextName = R.attr($e, 'context');
		if ( !contextName ) return; 

	    var _self = BindingUtils;		
        var controller;
		try { 
			controller = $get(contextName);
		} catch(e) {
			if (window.console) console.log(e.stack || e.message);
		} 
		
		/* check if element is visible */
		var isVisible = true;
		if ( R.attr($e,'visibleWhen') ) {
			var expr = R.attr($e, 'visibleWhen');
			try {
				var res = expr.evaluate( $ctx(contextName) );
				isVisible = (res == 'false' || res == 'undefined' || res == null || res == false)? false: true;
			}
			catch(e) {
				if ( window.console && R.DEBUG ) console.log('error evaluating visibleWhen: ' + e.message);
		
				isVisible = false;
			}
		}
		/* run other options when element is visible */
		if ( isVisible==true ) 
		{
			if ( $e.is(':hidden') ) $e.show(); 
			
			/* check if there is a setting 'readonlyWhen' */
			if ( R.attr($e,'readonlyWhen') ) 
			{ 
				var readonly = true; 
				var expr = R.attr($e, 'readonlyWhen');
				try {
					var res = expr.evaluate( $ctx(contextName) );
					readonly = (res && res != 'false' && res != 'null' && res != 'undefined' && res != '');
				} 
				catch(e) {
					if ( window.console && R.DEBUG ) console.log('error evaluating readonlyWhen: ' + e.message);
					
					readonly = false;
				}				
					
				if (readonly == true) { 
					$e.attr('readonly', 'readonly'); 
				} else { 
					$e.removeAttr('readonly'); 
				} 
			} 
			
			/* check if there is a setting 'disableWhen' */
			if ( R.attr($e,'disableWhen') ) 
			{ 
				var disabled = true; 
				var expr = R.attr($e, 'disableWhen');
				try {
					var res = expr.evaluate( $ctx(contextName) );
					disabled = (res && res != 'false' && res != 'null' && res != 'undefined' && res != '');
				} 
				catch(e) {
					if ( window.console && R.DEBUG ) console.log('error evaluating disableWhen: ' + e.message);
					
					disabled = false;
				}				
					
				if (disabled == true) { 
					$e.attr('disabled', 'disabled'); 
				} else { 
					$e.removeAttr('disabled'); 
				} 
			} 
		}
		else {
			$e.hide();
		}
		

        if ( controller != null ) {
			if( controller.name == null ) controller.name = contextName;
			
			if( R.attr($e, 'action') ) {
				var action = R.attr($e, 'action');
				if( elem.type == 'text' ) {
					if( !$e.data('_keyup_binded') ) {
						$e.data('_keyup_binded',true)
						 .keyup(function(event){
							if(event.keyCode == 13){
								$get(controller.name).invoke( this, action );
							}
						});
					}
				}
				else {
					elem.onclick = function() { 
						$get(controller.name).invoke( this, action );  
					}
				}
			}
			
            var nodeName = elem.tagName.toLowerCase()
            if(nodeName == "input") {
				nodeName = nodeName + "_" + elem.type ;
			}
			else if( R.attr(elem, 'type') ) {
				nodeName = nodeName + "_" + R.attr(elem, 'type');
			}
			if( _self.handlers[nodeName] ) _self.handlers[nodeName]( elem, controller, idx, force );
        }
    };

	var containerLoader = function(idx, div ) {
		var contextName = R.attr(div, 'controller');
		if(div.id==null || div.id=='') div.id = contextName;
		var controller = $get(contextName);
		if( controller != null ) {
			if( controller.name == null ) controller.name = contextName;
			if( R.attr(div, "loadAction")!=null ) controller.loadAction = R.attr(div, "loadAction");
			controller.load();
		}
	};

    this.bind = function(ctxName, selector, force) {
		//just bind all elements that has the attribute context
		var idx = 0;
		var dockables = []; 
		var layouts = []; 
		var isUIDialog = selector? $(selector).hasClass('ui-dialog-content'): false;
		
		var $root = $('*', selector || document);
		/* first, process all layout containers */
		LayoutManager.processLayouts($root); 
		
        $root.filter(function() {
			if ( R.attr(this, 'context') ) { 
				controlLoader( idx++, this, force ); 
			} 
			else if (R.attr(this, 'dockto')) { 
				dockables.push(this); 
			} 
		});
		
		for (var i=0; i<dockables.length; i++) {
			if (isUIDialog == true) 
				RUI.initDockableElement(dockables[i]); 
			else 
				RUI.dockElement(dockables[i]); 
		} 
    };

    this.loadViews = function(ctxName, selector) {
        //loads all divs with context and displays the page into the div.
		var idx = 0;
        $('*', selector || document).filter(function() { 
			if( R.attr(this, 'controller') ) containerLoader( idx++, this );
		});
    };

    //utilities
    /*
    * use init input for input type of element. this will set/get values for one field
    * applicable for text boxes, option boxes, list.
    * assumptions:
    *     all controls have required,
    *     all controls set a single value during on change
    *     all controls get the value from bean during load
    *     all will broadcast to to reset dependent controls values, (those with depends attribute)
    * customFunc = refers to the custom function for additional decorations
    */
    this.initInput = function( elem, controller, customFunc ) 
	{
        var fldName = R.attr(elem, 'name');
        if( fldName==null || fldName=='' ) return;
        var c = controller.get(fldName);
        var o = $(elem);
        if (customFunc != null) { 
            customFunc(elem, controller);
        }
        elem.value = (c ? c : "" );
        var dtype = R.attr(o, "datatype");
        if ( dtype=="decimal" ) 
		{
			o.addClass('number-field decimal-field');
			o.css('text-align', 'right');	
			try { o.val(NumberUtils.getFixedValue(elem.value)); }catch(e){;}
			
            elem.onchange = function () { 
				controller.set(fldName, NumberUtils.toDecimal(this.value), this ); 
				try { o.val(NumberUtils.getFixedValue(this.value)); }catch(e){;}
			}
			elem.onkeypress = function(evt) { return checkNumericInput(evt, this, true); };
        }
        else if ( dtype=="integer") 
		{
			o.addClass('number-field integer-field');
			o.css('text-align', 'right');
            elem.onchange = function () { controller.set(fldName, NumberUtils.toInteger(this.value), this ); }
			elem.onkeypress = function(evt){ return checkNumericInput(evt, this); };
        }
        else if ( dtype=="date" )
		{
			o.addClass('date-field');
			o.datepicker({dateFormat:"yy-mm-dd"});
            elem.onchange = function () { controller.set(fldName, this.value, this ); }
        }
        else 
		{
			var tc = R.attr(elem,'textcase');
			if (tc == null || tc == 'undefined') tc = 'upper';
			
			if ( 'upper'==tc ) 
				o.css('text-transform', 'uppercase');
			else if ( 'lower'==tc ) 
				o.css('text-transform', 'lowercase');
			else if ( 'none'==tc ) 
				o.css('text-transform', 'none');
			
            elem.onchange = function () {
				var v = this.value;
				var tc = R.attr(this,'textcase');
				if (!tc) tc = 'upper';
				
				if ( 'upper'==tc )
					v = v.toUpperCase();
				else if ( 'lower'==tc )
					v = v.toLowerCase();

				controller.set(fldName, v, this); 
			};
        }

		//add hints
		if( R.attr(elem, "hint")!=null ) {
			new InputHintDecorator( elem );
		}

        //add additional input behaviors
        //$(this.input_attributes).each(
        //    function(idx,func) { func(elem, controller); }
        //)
    };

	function checkNumericInput(evt, elem, allowPeriod)
	{
		var charCode = (evt.which) ? evt.which : event.keyCode;
		var allowed = (charCode==45 || (charCode >= 48 && charCode <= 57));
		
		if( allowPeriod ) 
			allowed = allowed  || charCode==46;
		
		if (allowed) 
		{
			//a period character 
			if (charCode == 46) 
			{
				if (!elem) return true;
			
				var s = (elem.value ? elem.value : ''); 
				if (s.length == 0) return false;
				if (s.indexOf('.') >= 0) return false; 
			} 
		
			return true; 
		} 
		else 	
			return false; 
	}

	this.notifyDependents = function(dependName, selector) {
		if (!dependName) return;
		
		var idx = 0;
		$('*', selector).filter(function(){
			var attr = R.attr(this, 'depends');		
			if ( attr && attr.match('.*' + dependName + '.*') ) {
				controlLoader( idx++, this ); 
			} 
		});
	};


	this.load = function(selector) {
		for( var i=0; i < this.loaders.length; i++ ) {
            this.loaders[i]();
        }
        this.loaders = [];

        this.bind(null,selector);
        this.loadViews(null,selector);
	};

} //-- end of BindingUtils class


var LayoutManager = new function(){
	var self = this;
	
	this.templates = {}; 
	
	this.processLayouts = function(container){ 
		var $container = container.jquery? container: $(container);	
		$container.find('[layout]').each(function(idx,item){ 
			LayoutManager.layout(item); 
		}); 
	} 
	
	this.layout = function(elem){ 
		var $e = elem.jquery? elem: $(elem);	
		var layoutname = $e.attr('layout'); 
		if (!layoutname) return; 
		
		$e.hide();
		$e.attr('layout', null); 
		
		if (this.templates[layoutname]) 
		{
			var tpl = this.templates[layoutname]($e); 
			if (tpl) {
				if ($e.attr('id')) tpl.attr('id', $e.attr('id')); 
				if ($e.attr('class')) tpl.addClass($e.attr('class')); 	
				
				$e.attr('id', null);
				$e.attr('class', null); 
				$e.html("");
				tpl.insertBefore($e);
				self.processLayouts(tpl); 
			} 
		} 
	} 
} 

LayoutManager.templates.borderlayout = function(container){
	var $sectop = container.children('[section=top]'); 
	if ($sectop.length > 0) $sectop.remove();
	
	var $secleft = container.children('[section=left]'); 
	if ($secleft.length > 0) $secleft.remove();
	
	var $secright = container.children('[section=right]'); 
	if ($secright.length > 0) $secright.remove();
	
	var $secbottom = container.children('[section=bottom]'); 
	if ($secbottom.length > 0) $secbottom.remove();
	
	var $row = null; 
	var $col = null; 
	var $table = $('<table class="borderlayout" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tbody></tbody></table>');
	var $tbody = $table.children('tbody');
	if ($sectop.length > 0) { 
		$row = $('<tr><td class="borderlayout-section-top" colspan="3" style="height:1px;"/></tr>');
		$row.appendTo($tbody);
		
		$col = $row.children('td'); 
		if ($sectop.attr('class')) $col.addClass($sectop.attr('class')); 
		
		$col.html($sectop.html());
	} 
	
	$row = $('<tr><td class="borderlayout-section-left" valign="top" style="width:1px;"/><td class="borderlayout-section-content" valign="top"/><td class="borderlayout-section-right" valign="top" style="width:1px;"/></tr>');
	if ($secleft.length > 0) {
		$col = $row.children('.borderlayout-section-left');
		if ($secleft.attr('class')) $col.addClass($secleft.attr('class')); 
		
		$col.html($secleft.html());
	} 
	else {
		$row.find('.borderlayout-section-left').remove(); 
	} 	
	$col = $row.children('.borderlayout-section-content'); 
	$col.html(container.html());
	if ($secright.length > 0) {
		$col = $row.children('.borderlayout-section-right');
		if ($secright.attr('class')) $col.addClass($secright.attr('class')); 
		
		$col.html($secright.html());
	} 
	else {
		$row.find('.borderlayout-section-right').remove(); 
	} 
	$row.appendTo($tbody); 
	if ($secbottom.length > 0) { 
		$row = $('<tr><td class="borderlayout-section-bottom" colspan="3" style="height:1px;"/></tr>');
		$row.appendTo($tbody);
		
		$col = $row.children('td'); 
		if ($secbottom.attr('class')) $col.addClass($secbottom.attr('class')); 
		
		$col.html($secbottom.html());
	} 
	return $table;
}

LayoutManager.templates.inboxlayout = function(container){
	var $sidebar = container.children('[section=sidebar]'); 
	if ($sidebar.length > 0) $sidebar.remove();

	var $table = $('<table class="inboxlayout" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tbody><tr/></tbody></table>');
	var $row = $table.find('tbody tr');
	var $col = null; 	
	if ($sidebar.length > 0) { 
		$col = $('<td class="inboxlayout-section-sidebar" valign="top" width="100" style="min-width:100px;"/>');
		$col.appendTo($row);
		if ($sidebar.attr('class')) $col.addClass($sidebar.attr('class')); 
		
		$col.html($sidebar.html());
	} 
	$col = $('<td class="inboxlayout-section-content" valign="top"/>');
	$col.html(container.html()); 
	$col.appendTo($row); 
	return $table; 
}


/**---------------------------------------------------*
 * input hint support (InputHintDecorator class)
 *
 * @author jaycverg
 *----------------------------------------------------*/
function InputHintDecorator( inp, hint ) {
	var input = $(inp);
	if( input.data('hint_decorator') ) {
		input.data('hint_decorator').refresh();
		return;
	}

	//find or create the wrapper
	var wrapper;
	if( input.parent('.hint-wrapper').length > 0 )
		wrapper = input.parent('.hint-wrapper');
	else
		wrapper = input.wrap('<span class="hint-wrapper"></span>').parent();
	
	wrapper.css({display:'inline-block', position:'relative'});
	
	input.keyup(input_keyup)
	 .keypress(input_keypress)
	 .focus(input_focus)
	 .blur(input_blur)
	 .change(input_change)
	 .bind('paste', hideHint)
	 .data('hint_decorator', this);

	var span;
	if( wrapper.find('span.hint:first').length > 0 )
		span = wrapper.find('span.hint:first');
	else
		span =  $('<span class="hint"></span>').insertBefore( input );
	
	if( R.attr(inp, 'hintclass') ) {
		span.addClass(R.attr(inp, 'hintclass'));
	}
	
	span.html( hint? hint : R.attr(input, 'hint') )
	 .css({position:'absolute', overflow:'hidden', top:'0', left:'0'})
	 .hide()
	 .disableSelection()
	 .click(onClick);

	this.refresh = refresh;

	//refresh
	refresh();
	
	if( document.activeElement == input[0] ) input_focus();

	function refresh(){
		if( !input.val() )
			showHint();
		else
			hideHint();
	}

	function position() {
		var pos = input.position();
		var css = {};
		css.left = parseValue(input.css('padding-left')) + parseValue(input.css('margin-left')) + parseValue(input.css('border-left-width'))+2;
		css.top = parseValue(input.css('padding-top')) + parseValue(input.css('margin-top')) + parseValue(input.css('border-top-width'));
		//css.width = span[0].offsetWidth > input.width() ? input.width() : span[0].offsetWidth;
		span.css( css );
	}
	
	function parseValue( value ) {
		return value=='auto'? 0 : parseInt( value );
	}

	function showHint() {
		span.show();
		position();
	}

	function hideHint() {
		span.hide();
	}

	function onClick(){
		input.focus();
	}

	function input_focus() {
		if(!span.hasClass('hint-hover')) span.addClass('hint-hover');
	}

	function input_blur() {
		if(span.hasClass('hint-hover')) span.removeClass('hint-hover');
		refresh();
	}

	function input_keyup() {
		if( !input.val() ) showHint();
	}

	function input_keypress(evt) {
		if( span.is(':hidden') ) return;
		if( isCharacterPressed(evt) ) hideHint();
	}
	
	function input_change(evt) {
		if( !input.val() )
			showHint();
		else
			hideHint();
	}
	
	function isCharacterPressed(evt) {
		if (typeof evt.which == "undefined") {
			return true;
		} else if (typeof evt.which == "number" && evt.which > 0) {
			return !evt.ctrlKey && !evt.metaKey && !evt.altKey && evt.which != 8 && evt.which != 13;
		}
		return false;
	}

}//-- end of InputHintDecorator class
	
	

//BeanUtils is for managing nested beans
var BeanUtils = new function(){
    this.setProperty = function( bean, fieldName, value ) {
		try {
			eval( 'bean.'+fieldName + '= value');

			var pcl = bean.propertyChangeListener;
			if( pcl && pcl[fieldName] ) {
				pcl[fieldName]( value );
			}
		}
		catch(e){;}
    }

    this.getProperty = function( bean, fieldName ) {
		try {
        	return eval( 'bean.' + fieldName );
        }
        catch(e) {
			if( window.console && R.DEBUG ) console.log('BeanUtils.getProperty warning: ' + e.message);
		}
    }

	this.setProperties = function( bean, map ) {
		for( var n in map ) {
			this.setProperty( bean, n, map[n] ); 
		}
	}
	
	this.invokeMethod = function( bean, action, args ) {
		var _act = action;
        if(!_act.endsWith("\\)")) {
			if(args==null) {
				_act = _act + "()";
				}
            else {
				_act = _act + "(args)";
            }
        }
        return eval('bean.' + _act );
	}
}

//VALIDATORS
function RequiredValidator( fieldName, caption, elem ) 
{
    this.fieldName = fieldName;
    this.caption = caption;
	this.elem = elem;

    this.validate = function( obj, errs, errElems ) {
        var data = BeanUtils.getProperty( obj, this.fieldName );
        if( data == "" || data == null ) {
			if( errElems ) errElems.push( this.elem );
			errs.push( this.caption + " is required" );
		}
    }
}

function Controller( code, pages ) {

    this.name;
    this.pages = pages;
    this.code = code;
    this.loadAction;
    this.window;
	this.currentPage;
	this.bookmark;
	
	this.container;
	
    this.set = function(fieldName, value, elem) {
		if( elem && $(elem).is(':hidden') ) return;
		
        BeanUtils.setProperty( this.code, fieldName, value );
		this.notifyDependents( fieldName );
    }

	this.notifyDependents = function(dependName) {
		BindingUtils.notifyDependents( dependName );
	}

    this.get = function(fieldName ) {
        return BeanUtils.getProperty( this.code, fieldName );
    }

    this.refresh = function( fieldNames ) {
        //try to use jquery here.
		var selector;
		if( this.container && this.container.element ) selector = this.container.element;
        if(this.name!=null) BindingUtils.bind( this.name, selector )
    }

    this.reload = function() {
        this.navigate( "_reload" );
    }

    this.invoke = function( control, action, args, immed, refresh  ) {
		try {
			var immediate =  false;
			if( immed !=null ) immediate = immed;
			if( refresh != false ) refresh = true;
			
			//check validation if not immediate.
			if( control ) {
				if( R.attr(control, "immediate") ) {
					immediate = R.attr(control, "immediate");
				}
				if( R.attr(control, "target") ) {
					target = R.attr(control, "target");
				}
				if( R.attr(control, "refresh") ) {
					refresh = R.attr(control, "refresh");
				}
			}
			if(immediate=="false" || immediate==false) this.validate();
			
			//-- process action name
			if( action.startsWith("_") ) {
				if( refresh == true || refresh == 'true' )
					this.navigate( action, control );
			}
			else {
                var target = this.name;
                if(this.code == null) throw new Error( "Code not set");
				
				/*added support for parameters that are set when firing a button or action.*/
				if( R.attr($(control), "params") ) {
					try {
						var _parms  = $.parseJSON(R.attr($(control), 'params'));
						BeanUtils.setProperties( this.code, _parms );
					}
					catch(e) {
						if(window.console && R.DEBUG) console.log("error in control params " + e.message );
					}
				}
				
                var outcome = action;
                if( !outcome.startsWith("_")) {
                    outcome = BeanUtils.invokeMethod( this.code, action, args );
                }
				if( refresh == true || refresh == 'true' )
					this.navigate( outcome, control );
            }
        }
		catch(e) {
			if(window.console) console.log(e.stack || e);
			alert( e.message, "ERROR!" );
		}
    }

    this.navigate = function(outcome, control) {
        if(outcome==null) {
			if(this.container && this.container.refresh) {
				this.container.refresh();
			}
			else {
				this.refresh();
			}
        }
        else if(outcome.classname == 'opener' ) {
			outcome.caller = this;
			outcome.source = control;
			outcome.load();
        }
        else if( outcome == "_close" ) {
			if( this.container && this.container.close ) {
                this.container.close();
            }
        }
		else if( outcome == "_reload" ) {
			if(this.container && this.container.reload) {
				this.container.reload();	
			}
			else {
				//intended only for <div r:controller="name"></div>
				var _outcome = this.currentPage;	
				var _target = this.name;
				var _controller = this;
				
				var tgt = $('#'+_target);
				//if  target is specified reload the content of the target element
				if( tgt.length > 0 ) {
					tgt.load( this.pages[_outcome], WindowUtil.getAllParameters('#'+_target), function() { 
						if( _controller.code.onpageload != null ) _controller.code.onpageload(_outcome);
						_controller.refresh(); 
					});
				}
				else { //otherwise just reload the current page
					window.location.reload();
				}
			}
		}
        else {
			//intended only for <div r:controller="name"></div>
			if( outcome == null ) outcome = "default";
            if(outcome.startsWith("_")) outcome = outcome.substring(1);
			
			var qrystr;
			if( outcome.indexOf('?') >= 0 ) {
				outcome = outcome.split('?');
				qrystr = outcome[1];
				outcome = outcome[0];
			}
			
			this.currentPage = outcome;
            var target = this.name;
            var _controller = this;
			var params = WindowUtil.getAllParameters();
			if( qrystr ) {
				var p = buildParamFromStr( qrystr );
				$.extend(params,p);
			}
			
			$('#'+target).load(this.pages[outcome], params, function() { 
                if ( _controller.code.onpageload != null ) _controller.code.onpageload(outcome);
				
                _controller.refresh(); 
            });
        }
    }
	
	function buildParamFromStr( str ) {
		var vars = {}, hash;
		var hashes = str.split('&');
		for(var i = 0; i < hashes.length; i++)
		{
			hash = hashes[i].split('=');
			vars[hash[0]] = hash[1];
		}
		return vars;
	}

    this.validate = function( selector ) {
        var errs = [];
		var errElems = [];
        var code = this.code;
		var name = this.name;
		var selector;
		if( this.container && this.container.element ) selector = this.container.element;
        $('*', selector || document).filter(
            function() {
				if( !R.attr(this, 'name') || R.attr(this, 'context') != name ) return;
				
				var o = $(this);
                if( o.is(':hidden') ) return;
				if( R.attr(this, 'required') != 'true' ) return;
                
				$(this).removeClass('error');
                var fldName = R.attr(this, 'name');
                var caption = fldName;
                if( R.attr(this, "caption") ) caption = R.attr(this, "caption");
                new RequiredValidator(fldName, caption, this ).validate( code, errs, errElems );
            }
        )
        if( errs.length > 0 ) {
			if(errElems) errElems[0].focus();
			$(errElems).addClass('error');
            throw new Error( errs.join("\n") );
        }
    }

    this.load = function() {
        if( this.loadAction!=null ) {
            var result = this.invoke( null, this.loadAction );
            if(result==null) {
                this.navigate( "default" );
            }
        }
        else {
            this.navigate( this.currentPage || "default" );
        }
    }
	
	this.focus = function(name) {
		var func = function() { $('[name="'+name+'"]').focus(); }
		setTimeout( func, 1 ); 
	}
}


var ContextManager = new function() {
    this.data = {}
    
    this.create = function( name, code, pages ) {
        if(name==null)
            throw new Error("Please indicate a name");
        var c = new Controller( code, pages );
        if(code.onload!=null) {
            BindingUtils.loaders.push( function() {
				var result = code.onload(); 
				if( typeof result == 'string' )
					c.currentPage = result;
			});
        }
		code._controller = c;
		code.close = function(){ code._controller.navigate("_close"); };
		c.name = name;
        this.data[name] = c;
        return c;
    },

    this.get = function(name) {
        var c = this.data[name];
        if( c == null ) throw new Error(name + " does not exist");
        return c;
    }
}

//******************************************************************************************************************
// configure input controls
//******************************************************************************************************************
BindingUtils.handlers.input_text = function(elem, controller, idx ) {
	BindingUtils.initInput(elem, controller, function(elem,controller) 
	{
		var input = $(elem);
		var suggExpr = R.attr(input, 'suggestExpression');
		var suggTpl = R.attr(input, 'suggestTemplate');
		var suggPreview = R.attr(input, 'suggestPreview');
		
		var suggName = R.attr(input, 'suggestName');
		if( R.attr(input, 'selectedItem') ) suggName = R.attr(input, 'selectedItem');
		
		if( R.attr(input, 'suggest') && input.autocomplete ) {
			var src = controller.get(R.attr(input, 'suggest'));
			if( typeof src ==  'function' ) {
				var fn = src;
				src = function(req, callback) {
					var result = fn( req.term, callback);
					if( result ) callback(result);
				}
			}
			input.autocomplete({ source: src, focus: suggestFocus, select: suggestSelect, change: suggestChange });
			input.data('autocomplete')._renderItem = suggestItemRenderer;
		} else if(R.attr(input, 'control') == 'actionfield') {
			input.removeClass('actionfield').addClass('actionfield'); 
			input.wrap('<span class="actionfield-wrapper"/>'); 
			var wrapper = input.parent();
			wrapper.append('<span class="button-icon button-icon-actionfield"/>'); 
		} 
		
		//helper functions
		function suggestItemRenderer(ul, item) {
			var html;
			if(suggTpl) {
				html = $('#'+suggTpl).html();
				html = unescape(html).evaluate(item);
			}
			else if(suggExpr) {
				html = '<a>'+suggExpr.evaluate(item)+'</a>';
			}
			else {
				html = '<a>'+item+'</a>';
			}
			
			return $( "<li></li>" )
				.data( "item.autocomplete", item )
				.append( html )
				.appendTo( ul );
		}
		
		function suggestFocus( event, ui ) {
			if( suggPreview != 'true' ) return false;
			
			if( suggExpr ) {
				var lbl = suggExpr.evaluate( ui.item );
				input.val( lbl );
				return false;
			}
		}
		
		function suggestSelect( event, ui ) {
			var value;
			if( suggExpr ) {
				value = suggExpr.evaluate( ui.item );
			}
			else if( ui.item.value ) {
				value = ui.item.value;
			}
			else {
				value = $.toJSON( ui.item );
			}
			
			input.val( value );
			input.trigger('change');

			if( suggName ) {
				controller.set(suggName, ui.item);
			}
			
			return false;
		}
		
		function suggestChange() {
			input.trigger('change');
		}
	});
};

BindingUtils.handlers.input_password = function(elem, controller, idx ) { BindingUtils.initInput(elem, controller ); };
BindingUtils.handlers.textarea = function(elem, controller, idx ) { BindingUtils.initInput(elem, controller); };
BindingUtils.handlers.select = function(elem, controller, idx ) {
	var i = 0;
	var name = R.attr(elem, 'name');
	var items = R.attr(elem, 'items');
	var selectedItem = R.attr(elem, 'selectedItem');
	var selected = controller.get( name );
	
	if( items ) $(elem).empty();
	
	if(R.attr($(elem), "allowNull")=="true") {
		var txt = R.attr($(elem), "emptyText");
		if(txt==null) txt = "-";
		elem.options[0] = new Option(txt,"");
		i = 1;
	}
	
	if( items!=null && items!='') {
		var itemKey = R.attr($(elem), "itemKey");
		var itemLabel = R.attr($(elem), "itemLabel");
		var arr = controller.get(items);
		$(arr).each( function(idx,value) {
			var _key = value;
			if( itemKey != null ) _key = value[itemKey];
			var _label = value+'';
			if( itemLabel != null ) _label = value[itemLabel];

			var op = new Option(_label,_key+'');
			
			$(op).data('value', _key);
			$(op).data('object_value', value);
			elem.options[idx+i] = op;
			op.selected = (_key == selected);
		});
	}
	else if( elem.options.length > 0 ) {
		$(elem.options).each(function(i,option){
			option.selected = (option.value == selected);
		});
	}

	if( !$(elem).data('_binded') ) {
		$(elem).change(function(){
			var op = this.options[this.selectedIndex];
			var objval = $(op).data('value');
			if( name )
				controller.set(name, (objval? objval : op? op.value : null), this );
				
			objval = $(op).data('object_value');
			if( selectedItem )
				controller.set(selectedItem, objval, this);
		})
		.data('_binded', true);
		
		//fire change after bind to set default value
		$(elem).change();
	}
}

BindingUtils.handlers.input_radio = function(elem, controller, idx ) {
	var name = R.attr(elem, 'name');
	var c = controller.get(name);

	//set the name of all input type="radio" having the same r:name value
	//so that it will be group by name
	$(elem).attr('name', name);
	
	var value = elem.value;
	var checked = (c==value) ? true :  false;
	if( checked )
		$(elem).attr('checked', 'checked');
	else
		$(elem).removeAttr('checked');

	elem.onchange = function () {
		if( this.checked ) {
			controller.set(name, this.value, this );
		}
	}
}

BindingUtils.handlers.input_checkbox = function(elem, controller, idx ) {
	if( $(elem).data('__ui_binded') ) return;
	$(elem).data('__ui_binded', true); //just bind once
	
	var name = R.attr(elem, 'name');
	var c = controller.get(name);
	if( R.attr($(elem), "mode") == "set" ) {
		try {
			var checkedValue = R.attr($(elem), "checkedValue");
			if( checkedValue ) {
				if( c.find( function(o) { return (o==checkedValue ) } ) !=null) {
					elem.checked = true;
				}
				else {
					elem.checked = false;
				}
			}
			else {
				var uncheckedValue = R.attr($(elem), "uncheckedValue");
				if( c.find( function(o) { return (o==uncheckedValue ) } ) !=null) {
					elem.checked = false;
				}
				else {
					elem.checked = true;
				}
			}
			$(elem).bind('change', function () {
				var _list = $get(controller.name).get(name);
				var v = R.attr($(this),  "checkedValue" );
				if(v) {
					if(this.checked) {
						_list.push( v );
					}
					else {
						_list.removeAll( function(o) { return (o == v) } );
					}
				}
				else {	
					v = R.attr($(this),  "uncheckedValue" );
					if(this.checked) {
						_list.removeAll( function(o) { return (o == v) } );
					}
					else {
						_list.push( v );
					}
				}	
				if(v==null) alert("checkedValue or uncheckedValue in checkbox must be specified","Error");
			});
		}
		catch(e) {}
	}
	else {
		var isChecked = false;
		var checkedValue = R.attr($(elem), "checkedValue");
		if( checkedValue !=null && checkedValue == c ) {
			isChecked = true;
		}
		else if( c == true || c == "true" ) {
			isChecked = true;
		}
		elem.checked = isChecked;
		$(elem).bind('change', function () {
			var v = (R.attr($(this),  "checkedValue" )==null) ? true : R.attr($(this),  "checkedValue" );
			var uv = (R.attr($(this),  "uncheckedValue" )==null) ? false : R.attr($(this),  "uncheckedValue" );
			$get(controller.name).set(name, (this.checked) ? v : uv );
		});
	}
}

BindingUtils.handlers.input_button = function( elem, controller, idx ) {
    var action = R.attr(elem, "name");
    if(action==null || action == '') return;
	
    elem.onclick = function() { 
		$get(controller.name).invoke( this, action ); 
		return false;
	}
};

BindingUtils.handlers.a = function( elem, controller, idx ) {
	var $e = $(elem);
    var action = R.attr($e, "name");
    
    //add an href property if not specified,
    //css hover does not apply when no href is specified
    if( !$e.attr('href') ) $e.attr('href', '#');
    
    elem.onclick = function() { 
		if( action ) {
			try {
				$get(controller.name).invoke( this, action ); 
			}
			catch(e) {
				if( window.console && R.DEBUG ) console.log( e.message );	
			}
		}
		return false; 
	}
}

BindingUtils.handlers.button = function( elem, controller, idx ) {
	var $e = $(elem);
	var styles = '';
    try {
    	var iconsize = parseInt($e.attr('iconsize')); 
    	if (iconsize) styles = 'padding-left:'+iconsize+'px;';
    } catch(e) {;}

    var action = R.attr($e, 'name');
    var iconurl  = $e.attr('iconurl'); 
    var iconname = $e.attr('icon');
    var iconhtml = null;
    if (iconurl) {
    	iconhtml = '<span class="button-icon button-icon" style="background:url('+iconurl+') no-repeat;'+styles+'"/>'; 
    } else if (iconname) {
    	iconhtml = '<span class="button-icon button-icon-'+iconname+'" style="'+styles+'"/>';
    } else if (action) {
    	iconhtml = '<span class="button-icon button-icon-'+action+'" style="'+styles+'"/>'; 
    } 

	if (iconhtml) {
		if ( !$e.hasClass('rui-button') ) { 
			$e.removeClass('rui-button-icononly'); 		
			$e.addClass('rui-button'); 
		} 
		
		if (!$e.children('.button-identifier')[0]) {
			var newhtml = '<span class="button-identifier" style="padding:0;margin:0;border:0;"/>';
			newhtml = newhtml + iconhtml;
			newhtml = newhtml + '<span class="button-icon-gap"/>';

			var oldhtml = $e.html();
			$e.html(newhtml + oldhtml);
		} 
	} 
	
    elem.onclick = function() { 
		if ( action ) {
			try {
				$get(controller.name).invoke( this, action ); 
			}
			catch(e) {
				if( window.console && R.DEBUG ) console.log( e.message );	
			}
		}
		return false; 
	}
};

BindingUtils.handlers.input_image = function( elem, controller, idx ) {
	var $e = $(elem);
    var action = R.attr($e, "name");
    
    elem.onclick = function() { 
		if( action ) {
			try {
				$get(controller.name).invoke( this, action ); 
			}
			catch(e) {
				if( window.console && R.DEBUG ) console.log( e.message );	
			}
		}
		return false; 
	}
};

BindingUtils.handlers.input_submit = function( elem, controller, idx ) {
    var action = R.attr(elem, "name");
    if(action==null || action == '') return;
    elem.onclick = function() { 
		$get(controller.name).invoke( this, action );  
		return false;
	};
};

/**
 *	label handlers
 *	label elements: 
 *		- <label></label> (default)
 *		- <span r:type="label"></span>
 *		- <div r:type="label"></div>
 */
(function(){
	BindingUtils.handlers.label = renderer;
	BindingUtils.handlers.span_label = renderer;
	BindingUtils.handlers.div_label = renderer;
	
	function renderer(elem, controller, idx)
	{
		var lbl = $(elem);
		
		if( R.attr(lbl, 'name') ) {
			var v = controller.get(R.attr(lbl, 'name'));
			lbl.html( v? v : '' );
		}
		else {
			var expr;
			if( lbl.data('expr')!=null ) {
				expr = lbl.data('expr');
			} else {
				expr = unescape(lbl.html());
				lbl.data('expr', expr);
			}

			//bind label elements
			lbl.html( expr.evaluate(controller.code) );
			BindingUtils.bind( null, lbl );
		}
	};
})();


BindingUtils.handlers.div = function( elem, controller, idx ){ 
	var div = $(elem);	
	var ctx = $ctx(controller.name);
	var panelName = R.attr(div, "name");
	if(panelName!=null) {
		
		var o = controller.get( R.attr(div, 'name') );
		var parms = WindowUtil.getAllParameters();
		if( typeof o == "string" ) {
			div.load( o, parms );
		}
		else if( o.classname == "opener" ) {
			if(o.params) {
				for( var n in o.params ) {
					parms[n] = o.params[n];
				}
			}
			div.load( o.page, parms );			
		}
	}	
};


/**----------------------------------*
 * file upload plugin
 *
 * @author jaycverg
 *-----------------------------------*/
BindingUtils.handlers.input_file = function( elem, controller, idx ) {
	
	var infile = $(elem);
	var div = infile.data('_binded');
	
	if( !div ) {
		div = $('<div></div>').insertBefore(elem)
		 .css('display', 'block').addClass('file-uploader');
		infile.data('_binded', div);
	};

	div.empty();

	//hide the original input file
	infile.hide().css('opacity', 0);

	//-- properties/callbacks
	var oncomplete = R.attr(infile, 'oncomplete');
	var onremove =   R.attr(infile, 'onremove');
	var labelExpr =  R.attr(infile, 'expression');
	var name =       R.attr(infile, 'name');
	var fieldValue = controller.get(name);
	var params =     R.attr(infile, 'params');
	
	var multiFile =  fieldValue instanceof Array;

	//upload box design
	var listBox =       $('<div class="files"></div>').appendTo(div);
	var inputWrapper =  $('<div style="overflow: hidden; position: absolute;"></div>');
	var anchorLbl =     $('<a href="#">' + R.attr(infile, 'caption') + '</a>');
	var anchorBox =     $('<div class="selector" style="position: relative"></div>');
	var lblWidth =  0;

	if( fieldValue ) {
		var items = multiFile? fieldValue : [fieldValue];
		for(var i=0; i<items.length; ++i) addToFileList(null,null,null,null,items[i]);
	}
	
	if( multiFile || !fieldValue ) {
		anchorBox.appendTo( div )
		.append( anchorLbl )
		.append( inputWrapper );
		
		lblWidth = anchorLbl[0].offsetWidth;
		inputWrapper.css({left: 0, top: 0, width: lblWidth});
		
		attachInput();
	}
	
	
	function attachInput() {
		var input = $('<input type="file" name="file"/>');
		input.appendTo( inputWrapper )
		 .change(file_change)
		 .css({
			position:'relative', opacity: 0, cursor: 'pointer', 
			left: -(input[0].offsetWidth - lblWidth)
		 });
	}

	function file_change(e) {
		var frameid = '__frame' + Math.floor( Math.random() * 200000 );
		var input =   $(this).remove().attr('name', frameid);
		var frame =   createFrame(frameid);
		var form =    createForm(frameid, input);
		var pBar =    $('<div class="bar"><div class="progress"></div></div>');

		addToFileList(frame, form, pBar, input);

		var req = new ProgressRequest( pBar, frameid );
		frame.load(function(){
			req.completed();
			frame_loaded(frame);
		});

		form.submit(function(){
			req.start();
		});

		if( multiFile ) 
			attachInput();
		else
			anchorBox.hide();
		
		form.submit();
	}
	
	function getCaption( value ) {
		return value? 
		        (cap = labelExpr? labelExpr.evaluate(value) : $.toJSON(value)) : 
		        'No Caption';
	}

	function frame_loaded(frame) {
		var value = null;
		var lbl = frame.parent().find('div.label')

		var resptext = frame.contents().text().trim();
		try {
			value = $.parseJSON(resptext);
		}catch(e){
			alert( resptext, "Upload Error" );
			controller.refresh();
			return;
		}

		if( name ) {
			if( multiFile )
				controller.get(name).push(value);
			else
				controller.set(name, value);
		}
		lbl.html( getCaption(value) );
		
		if( oncomplete ) 
			BeanUtils.invokeMethod( controller.code, oncomplete, value, true );

		if( onremove ) {
			$('<a href="#" class="remove">Remove</a>')
			 .appendTo( lbl )
			 .click(function(){
				var res = BeanUtils.invokeMethod( controller.code, onremove, {index: frame.parent().index(), value: value}, true );
				if( res == false || res == 'false' ) return;
				frame.parent().animate({opacity: 0}, {duration:400, complete:function(){ $(this).remove(); }});
			 });
		}
	}

	function addToFileList(frame, form, pBar, input, value) {
		var b = $.browser;

		//decorate progress bar
		if( pBar && frame ) {
			pBar.find('div.progress')
			.addClass( b.msie? '' : b.webkit? 'webk' : 'moz' )
			.attr('id', frame.attr('id') + '_progress');
		}

		//create the file item box
		var fibox = $('<div class="file"></div>').appendTo( listBox );
		if( frame ) fibox.append( frame );
		if( form )  fibox.append( form );
		fibox.append('<div class="label">' + (pBar && input? extractFilename(input.val()) : getCaption( value )) + '</div>')
		if( pBar )  fibox.append( pBar );
	}
	
	function extractFilename( filename ) {
		//*nix filename
		var idx = filename.lastIndexOf('/');
		if( idx >= 0 ) 
			return filename.substr(idx+1);

		//windows filename
		idx = filename.lastIndexOf('\\');
		if( idx >= 0 ) 
			return filename.substr(idx+1);
		
		return filename;
	}

	function createFrame( id ) {
		return $('<iframe src="" id="'+id+'" name="'+id+'"></iframe>').hide();
	}

	function createForm( target, input ) {
		var form = $('<form method="post" enctype="multipart/form-data"></form>')
			       .attr({ 'target': target, 'action': R.attr(infile, 'url') })
			       .append( input )
			       .append( '<input type="hidden" name="file_id" value="' +target+ '"/>' )
			       .hide();
		if( params ) {
			var txt = params.evaluate( controller.code );
			var p = eval('('+txt+')');
			if( p ) {
				for(var i in p) {
					$('<input type="hidden"/>')
					 .attr('name', i).val(p[i])
					 .appendTo(form);
				}
			}
		}
				   
		return form;
	}

	//-- utility inner class for file status pulling --
	function ProgressRequest( bar, reqId ) {

		var progress = bar.find('div.progress');
		var completed = false;


		this.start = function() {
			pullUpdates();
		};

		this.completed = function() {
			updateProgress( 100 );
			completed = true;
		};

		function pullUpdates() {
			if( completed ) return;

			$.ajax({
				url: R.attr(infile, 'url'),
				cache: false,
				data: 'fileupload.status=' + reqId,
				success: onPullResponse
			});
		}

		function onPullResponse(data) {
			try {
				var resp = $.parseJSON(data);
				//alert( data );
				updateProgress( resp.percentCompleted );
			}
			catch(e) {;}

			if( !completed ) {
				//throws error in IE if no deplay specified
				setTimeout( pullUpdates, 5 );
			}
		}

		var prevValue = 0;

		function updateProgress( value ) {
			value = (typeof value == 'number')? value : 0;
			prevValue = (value > prevValue)? value : prevValue;
			progress.stop().animate({width: prevValue+'%'}, {duration: 100, complete: function() {
				if( completed ) {
					bar.animate({opacity: 0}, {duration: 600, complete: function() {
						$(this).hide('fast');
					}});
				}
			}});
		}

	}

};// --- end of file upload plugin ---


/**----------------------------------*
 * table plugin
 *   - added visibleWhen property on <tr></tr> element
 *
 * @author jaycverg
 *-----------------------------------*/
BindingUtils.handlers.table = function( elem, controller, idx, force ) {
	var tbl = $(elem);
	
	//if already has a model, just refresh the model
	if( tbl.data('_has_model') ) {
		var model = tbl.data('_has_model');
		if( model && force ) model.refresh(true);
		return;
	}

	new DataTable( tbl, $ctx(controller.name), controller );
};

/*------ DataTable class ---------*/
function DataTable( table, bean, controller ) {
	var model = new DefaultTableModel( table );

	var multiselect = R.attr(table, 'multiselect') == 'true';
	var varStat =     R.attr(table, 'varStatus');
	var varName =     R.attr(table, 'varName');
	var name =        R.attr(table, 'name');

	if( R.attr(table, 'items') ) {
		model.setList( controller.get(R.attr(table, 'items')) );
		model.setUseCached( true );
	}
	else if( R.attr(table, 'model') ) {
		model.setDataModel( controller.get(R.attr(table, 'model')) );
		table.data('_has_model', model);
	}
	
	//set the selected if specified on the controller
	var selected = name? controller.get(name) : null;
	if( selected ) {
		model.clearSelection();
		model.select( selected );
	}

	var status = {prevItem: null, nextItem: null};
	var tbody = $(table.find('tbody')[0]);

	var tpl = table.data('template');
	if( !tpl ) {
		//tpl = tbody.find('tr').remove().clone(true);
		tpl = tbody.children('tr').remove().clone(true);
		table.data('template', tpl);
	}

	model.onRefresh = doRender;
	model.onAddItems = function(list, type, animate) {
		checkTableVisibility();
		renderItemsAdded(list, type, animate, true);
	};
	
	//load the model
	model.load();

	var tabIdx;

	function doRender() {
		checkTableVisibility();
	
		if( table.css('display') == 'table' ) {
			tbody.hide().empty();
			
			//evaluate expressions on the table header
			table.find('thead td, thead th').each(function(i,e){
				e.innerHTML = e.innerHTML.trim().evaluate( bean );
			});
			
			tabIdx = table.data('index');
			status.index = 0;
			
			var list = model.getList();
			if(list==null) list = [];
			
			var items = renderItemsAdded( list, null, false );
			$(items).each(function(i,e){ td_mousedown(e, true); });
			tbody.show();
		}

		BindingUtils.bind( null, table );
	}
	
	function checkTableVisibility() {
		var emptyText = R.attr(table,'emptyText');
		if( emptyText && model.isEmpty() ) {
			var emptyDiv = table.next('div.emptyText');
			if( emptyDiv.length == 0 ) {
				emptyDiv = $('<div class="emptyText"></div>').html(emptyText).insertAfter(table);
				if( R.attr(table,'emptyTextClass') ) emptyDiv.addClass(R.attr(table,'emptyTextClass'));
				if( R.attr(table,'emptyTextStyle') ) emptyDiv.attr('style', R.attr(table,'emptyTextStyle'));
			}
			emptyDiv.show();
			table.css('display', 'none');
		}
		else {
			table.css('display', 'table');
			var emptyDiv = table.next('div.emptyText');
			if( emptyDiv.length > 0 ) emptyDiv.hide();
		}
	}
	
	function renderItemsAdded( list, type, animate, bindItems ) {
		animate = (animate!=null)? animate : true;
		
		if( model.getSelectedItem() ) {
			controller.set(name, model.getSelectedItem());
		}
		var selected = name? controller.get(name) : null;
		
		var selectedTds = [];
		var fetchStyle = type? type : R.attr(table, 'fetchStyle');

		//render the rows
		var rows = [];
		for(var i=0; i<list.length; ++i) {
			var item = list[i];
			status.prevItem = (i > 0)? list[i-1] : null;
			status.nextItem = (i < list.length-1)? list[i+1] : null;

			var row = createRow(i, item);
			rows.push( row );
			if( animate ) row.css('opacity', 0).animate({opacity: 1});
			if( selected == item ) {
				var pos = table.data('selected_position');
				var td = pos ? $(row[pos.row]).find('td')[pos.col] : row.find('td:first:not([r\\:selectable])')[0];
				selectedTds.push( td )
			};
			status.index++;
		};
		
		if( fetchStyle == 'prepend' ) {
			//loop backwards
			for( var i=rows.length-1; i>=0; --i ) {
				tbody.prepend(rows[i]);
			}
		}
		else {
			rows.each(function(elm){ tbody.append(elm); });
		}

		var rows = model.getRows();
		
		//add only extra rows if rows is specified on the model
		//and the fetchStyle is 'paging'
		if( (!fetchStyle || fetchStyle == 'paging') && rows > 0 && list.length < rows ) {
			//add extra rows if the items size is less than the no. of rows
			for(var i=list.length; i<rows; ++i ) {
				createRow(i, null).appendTo( tbody );
				status.index++;
			}
		}
		
		var collapseWhenEmpty = R.attr(table, 'collapseWhenEmpty');
		if( collapseWhenEmpty != 'true' && rows == -1 && list.length == 0 ) {
			createRow(i, null).appendTo( tbody );
			status.index++;
		}
		
		if( bindItems ) BindingUtils.bind( rows );
		
		return selectedTds;
	}

	function createRow(i, item) {
		var className = (i%2==0)? 'even': 'odd'; 
	
		return tpl.clone()
		 .addClass('row')
		 .addClass(className)		 
		 .data('index', i)
		 .each(function(i,e) 
		 {
			var tr = $(e);
			var origTr = $(tpl[i]);

			evalAttr(origTr[0],e,item);
			if( R.attr($(e), 'visibleWhen') ) {
				var visible = R.attr($(e), 'visibleWhen').evaluate( createEvalCtx(item) );
				if( visible != 'true' ) $(e).css('display', 'none');
			}

			var td = tr.find('td')
			           .mousedown( td_mousedown )
			           .hover( td_mouseover, td_mouseout );;
			var origTd = origTr.find('td');

			if( !item ) {
				td.html('&nbsp;');
			}
			else {
				td.each(function(idx,e){
					var td = $(e).data('position', {row: i, col: idx }); //keep the td position
					var value;
					if( R.attr(td, 'name') )
					value = "#{"+ R.attr(td, 'name') +"}".evaluate( createEvalCtx(item) );
					else if ( R.attr(td, 'expression') )
						value = R.attr(td, 'expression').evaluate( createEvalCtx(item) );
					else
						value = unescape(td.html()).evaluate( createEvalCtx(item) );

					td.html( value? value+'' : '&nbsp;' );
					evalAttr(origTd[idx],e,item);
				});
			}

			if (td[0] && td.length > 0) {
				$(td[0]).removeClass('first-col').addClass('first-col'); 
				$(td[td.length-1]).removeClass('last-col').addClass('last-col'); 
			} 
		 }); //-- end of each function
	}//-- end of createRow function


	//-- TD event support --
	var prevRow;
	var prevTd;

	function td_mousedown(e, forced) {
		var td = e.tagName? $(e) : $(this);

		if ( R.attr(td, 'selectable') == 'false' ) return;
		if ( prevTd ) { 
			/* do not fire beforeRowChange when both TDs are referenced to one object */ 
			if (!prevTd.is(td)) { 
				var beforeRowChangeAction = R.attr(table, 'beforeRowChange'); 
				if (beforeRowChangeAction) {
					try {
						var retval = BeanUtils.invokeMethod( controller.code, beforeRowChangeAction); 
						if (retval == false) return; 
					} 
					catch(e) { 
						alert("ERROR:" + e); 
						return; 
					} 
				} 
			} 
			prevTd.removeClass('selected');
		} 
		
		if ( td.hasClass('selected') )
			td.removeClass('selected');
		else
			td.addClass('selected');

		prevTd = td;
		
		if( !multiselect && prevRow ) {
			prevRow.removeClass('selected');
			model.unselect( prevRow.data('index') );
		}
		
		var tr = td.parent();
		if( tr.hasClass('selected') ) {
			tr.removeClass('selected');
			model.unselect( tr.data('index') );
		}
		else {
			tr.addClass('selected');
			model.select( tr.data('index') );
		}

		prevRow = tr;
		
		//if name is specified, update the value
		if( !forced && name ) {
			controller.set( name, multiselect? model.getSelectedItems() : model.getSelectedItem() );	
			
			//keep the selected td index to the table element
			table.data('selected_position', td.data('position'));
		}
	}
	
	function td_mouseover() {
		if( R.attr($(this), 'selectable') == 'false' ) return;
		
		$(this).addClass('hover')
		 .parent().addClass('hover');
	}
	
	function td_mouseout() {
		if( R.attr($(this), 'selectable') == 'false' ) return;
		
		$(this).removeClass('hover')
		 .parent().removeClass('hover');
	}

	function evalAttr(origElem, cloneElem, ctx) {
		origElem = origElem.jquery? origElem[0] : origElem;

		$(origElem.attributes).each(function(idx,attr){
			if( !attr.specified || !attr.value ) return;
			if( attr.name.toLowerCase().startsWith('jquery') ) return; //this issue occured in IE

			try {
				var attrName = attr.name.toLowerCase();
				var attrValue = $(origElem).attr(attrName).evaluate( createEvalCtx(ctx) );
				if( attrName.endsWith('expr') ) {
					attrName = attrName.replace(/expr$/, '');
				}
				$(cloneElem).attr(attrName, attrValue);
			}
			catch(e) {;}
		})
	}

	function createEvalCtx( item ) {
		var ctx = $.extend({},bean);
		if( varStat ) ctx[varStat] = status;
		if( varName ) 
			ctx[varName] = item;
		else
			$.extend(ctx, item);

		return ctx;
	}

} //-- end of DataTable class


/*-------- default internal table model ------------------*/
function DefaultTableModel() {

	var _this = this;
	var _list;
	var _dataModel;
	var _listParam = null;
	
	//used as flag when the whole list is specified
	var _isUseCached = false;
	
	var _isLast = false;
	var _isFetching = false;

	var _selectedItems = [];

	//on refresh callback
	this.onRefresh;
	this.onAddItems;

	this.select = function(idx) {
		if( typeof idx == 'object' ) {
			_selectedItems.push( idx );
		}
		else if( typeof idx == 'number' ) 
		{
			if( idx >=0 && idx < _list.length )
				_selectedItems.push( _list[idx] );
		}
	};

	this.unselect = function(idx) {
		var obj = _list[idx];
		if( _selectedItems.indexOf ) {
			idx = _selectedItems.indexOf( obj );
		}

		if( idx >= 0 ) _selectedItems.splice(idx, 1);
	};
	
	this.clearSelection = function() {
		_selectedItems = [];
	}
	
	this.getSelectedItems = function() {
		return _selectedItems;
	};
	
	this.getSelectedItem = function() {
		var len = _selectedItems.length;
		return len > 0? _selectedItems[len-1] : null;
	};

	this.getRows = function() {
		return _listParam? _listParam._limit-1 : -1;
	};

	this.setDataModel = function( mdl ) {
		_dataModel = mdl;
		initDataModel();
	};

	this.getDataModel = function() { return _dataModel; };

	this.setList = function( list ) {
		var selected = this.getSelectedItem();
		var oldidx = selected && _list ? _list.indexOf( selected ) : -1;
		
		_list = list || [];
		_selectedItems = [];
		
		if( _listParam ) {
			if( _list.length == _listParam._limit ) {
				_list.length = _listParam._limit-1;
				_isLast = false;
			}
			else {
				_isLast = true;
			}
		}
		
		if( oldidx == -1 && selected )
			oldidx = _list.indexOf( selected );

		oldidx = (oldidx >= 0 && oldidx < _list.length) ? oldidx : 0;
		_this.select( oldidx );
		
		doRefresh(false);
	};

	this.getList = function() {
		if( typeof _list == 'undefined' ) _list = [];
		return _list;
	};
	
	this.isEmpty = function() {
		return !_list || _list.length == 0;
	};

	this.load = function() {
		if( _listParam ) _listParam._start = 0;
		_isLast = false;
		doRefresh(true);
	};

	this.setUseCached = function( useCached ) {
		_isUseCached = useCached;
	};
	
	this.refresh = doRefresh;

	//if fetch flag is set to true, this method fetches data from the callback
	function doRefresh( fetch ) {
		if( !_isUseCached && fetch == true ) 
		{
			if( _dataModel && $.isFunction( _dataModel.fetchList ) ) 
			{
				if( _this._isFetching ) return;
				
				_this._isFetching = true;
				setTimeout(function()
				{
					try 
					{
						var fetchParam = _listParam || {}; 
						$.each(_dataModel.query || {}, function(k,v){
							fetchParam[k] = v; 
						}); 

						var result = _dataModel.fetchList( fetchParam );
						_this.setList( result );
					}
					catch(e) {
						if( window.console ) console.log( e.stack || e );
						throw e;
					}
					finally {
						_this._isFetching = false;
					}
				}, 1 );
				
			}
		}
		else if( $.isFunction( _this.onRefresh ) ) 
		{
			_this.onRefresh();
		}
	}
	
	function fetchNext() 
	{
		if( 'prepend' != _dataModel.fetchStyle && 'append' != _dataModel.fetchStyle )
			throw new Error('You cannot invoke fetchNext() if fetchStyle is not either append or prepend.');
		
		if( _dataModel && $.isFunction( _dataModel.fetchList ) ) 
		{
			if( _this._isFetching ) return;
			
			_this._isFetching = true;
			setTimeout(function() 
			{
				try 
				{
					if( _listParam ) {
						if( _isLast ) return;
						_listParam._start += _listParam._limit-1;
					}
					
					var fetchParam = _listParam || {};
					var fetchStyle = _dataModel.fetchStyle;
					
					if( 'prepend' == _dataModel.fetchStyle )
						fetchParam._last = _list.length > 0 ? _list[0] : null;
					else
						fetchParam._last = _list.length > 0 ? _list[ _list.length-1 ] : null;
					
					var result = _dataModel.fetchList( fetchParam );
					if( result ) {
						if( 'prepend' == fetchStyle )
							prependAll( result );
						else
							appendAll( result );
					}
				}
				catch(e) {
					if( window.console ) console.log( e );
					throw e;
				}
				finally {
					_this._isFetching = false;
				}
			}, 1 );
		}
	}
	
	function moveFirst() {
		if( _dataModel.fetchStyle && _dataModel.fetchStyle != 'paging' )
			throw new Error('You cannot invoke moveFirst() if fetchStyle is not paging.');
		
		if( _listParam ) _listParam._start = 0;
		doRefresh(true);
	}
	
	function moveNext() {
		if( _dataModel.fetchStyle && _dataModel.fetchStyle != 'paging' )
			throw new Error('You cannot invoke moveNext() if fetchStyle is not paging.');
		
		if( _listParam && !_isLast ) {
			_listParam._start += _listParam._limit-1;
		}

		doRefresh(true);
	}
	
	function movePrev() {
		if( _dataModel.fetchStyle && _dataModel.fetchStyle != 'paging' )
			throw new Error('You cannot invoke movePrev() if fetchStyle is not paging.');
		
		if( _listParam && _listParam._start > 0 ) {
			_listParam._start -= _listParam._limit-1;
		}

		doRefresh(true);
	}

	function appendItem( item ) {
		appendAll( [item] );
	}
	
	function appendAll( list ) {
		if( !list ) return;
		
		if( _listParam ) {
			if( list.length == _listParam._limit ) {
				list.length = _listParam._limit-1;
				_isLast = false;
			}
			else {
				_isLast = true;
			}
		}
		
		if( $.isFunction( _this.onAddItems ) ) {
			_this.getList().addAll( list );
			_this.onAddItems( list, 'append' );
		}
	}
	
	function prependItem( item ) {
		prependAll( [item] );
	}
	
	function prependAll( list ) {
		if( !list ) return;
		
		if( _listParam ) {
			if( list.length == _listParam._limit ) {
				list.length = _listParam._limit-1;
				_isLast = false;
			}
			else {
				_isLast = true;
			}
		}
		
		if( $.isFunction( _this.onAddItems ) ) {
			_this.getList();
			_list = list.concat( _list );
			_this.onAddItems( list, 'prepend' );
		}
	}

	/**
	 * inject callback methods to the passed dataModel
	 * methods to be injected:
	 *   1. refresh( <optional boolean parameter> )
	 *      - the boolean parameter if true, the table fetches the list
	 *   2. load
	 *      - reloads the table, resets the start row to 0 (zero)
	 *   3. moveFirst, moveNext, movePrev, getSelectedItem, getSelectedItems
	 */
	function initDataModel() {
		if( !_dataModel ) return;

		_listParam = null;

		//inject handlers to the map table model from the codebean
		_dataModel.setList 	= _this.setList;
		_dataModel.getList 	= _this.getList;
		_dataModel.isEmpty 	= _this.isEmpty;
		_dataModel.load 	= _this.load;
		_dataModel.search 	= _this.load;
		_dataModel.fetchNext = fetchNext;
		_dataModel.refresh 	= doRefresh;
		_dataModel.moveFirst = moveFirst;
		_dataModel.moveNext = moveNext;
		_dataModel.movePrev   = movePrev;
		_dataModel.appendItem = appendItem;
		_dataModel.appendAll  = appendAll;
		_dataModel.prependItem = prependItem;
		_dataModel.prependAll = prependAll;
		_dataModel.hasMore    = function() { return !_isLast; };

		_dataModel.getSelectedItem = function() {
			var len = _selectedItems.length;
			return len > 0? _selectedItems[len-1] : null;
		};

		_dataModel.getSelectedItems = function() { return _selectedItems; };

		var rows = 10;
		if( typeof _dataModel.rows == 'number' ) {
			rows = _dataModel.rows;
		}
		
		if( rows > 0 ) {
			_listParam = {};
			_listParam._limit = rows+1;
			_listParam._start = 0;
		} 

		if (!_dataModel.query) _dataModel.query = {}; 		
	} 

}
// end of DefaultTableModel class

/**
 *  <OL> and <UL> plugin
 *    @author  jaycverg
 */

(function(){

	BindingUtils.handlers.ol = renderer;
	BindingUtils.handlers.ul = renderer;
	
	//shared renderer
	function renderer( elem, controller, idx ) {
		var $e = $(elem);
		if( !R.attr($e, 'items') ) return;
		
		var tpl = $e.data('___template');
		if( !tpl && !$e.data('___binded') ) {
			tpl = $e.html();
			$e.data('___template', tpl);
			$e.data('___binded', true);
		}

		var selected;
		if( R.attr($e, 'name') ) selected = controller.get( R.attr($e, 'name') );
		
		var varName = R.attr($e, 'varName');
		var varStat = R.attr($e, 'varStatus');
		var status = { index: 0 };
		
		$e.empty();
		$(controller.get(R.attr($e, 'items'))).each(function(i,o){
			var li;
			if( tpl ) {
				var html = unescape(tpl);
				li = $( (html+'').evaluate( createEvalCtx(o) ) );
			}
			else {
				li = $( '<li>' + o + '</li>' );
			}
			
			if( o == selected ) li.addClass('selected');
			
			li.data('value', o);
			$e.append( li );
			
			status.index++;
		});
		
		if( R.attr($e, 'name') ) {
			$e.find('li').mousedown(function(){
				controller.set(R.attr($e, 'name'), $(this).data('value'));
				$e.find('li').removeClass('selected');
				$(this).addClass('selected');
			});
		}
		
		if( tpl ) {
			BindingUtils.bind( null, $e );
		}
		
		//helper function
		function createEvalCtx( item ) {
			var ctx = $.extend({},controller.code);
			if( varStat ) ctx[varStat] = status;
			if( varName ) 
				ctx[varName] = item;
			else
				$.extend(ctx, item);

			return ctx;
		}
	}

})();

//-- end of <OL> and <UL> plugin

/**
 *  template tag plugin
 *    @author  jaycverg
 */
BindingUtils.handlers.template = function(elem, controller, idx) {
	var tag = $(elem);
	var div = $(tag).next('div.template');
	if( div.length == 0 ) {
		div = $('<div class="template"></div>').insertAfter(tag);
	}
	
	var p = {};
	var pjson = R.attr(tag, 'params');
	if( pjson ) {
		try{  p = eval('(' + pjson + ')'); }
		catch(e) {
			if( window.console ) console.log('Template params error: ' + e.message);
		}				
	}
	window.params = p;
	
	if( div.children().length == 0 ) {
		var tpl = $('div#' + R.attr(tag,'id'));
		div.empty().append( tpl.clone(true).show().removeAttr('id') );
		BindingUtils.bind( null, div );
	}
};
//-- end of <template> tag plugin --


var WindowUtil = new function() {

	this.load = function( page, args, hash ) {
		var qry = "";
		if(args!=null ) {
			qry = "?" + this.stringifyParams( args );
		}
		if( hash!=null ) {
			qry = qry + "#" + hash;
		}
		window.location = page + qry;
    }

	this.reload = function(args, hash) {
		var qry = "";
		if(args!=null ) {
			qry = "?" + this.stringifyParams( args );
		}
		if( hash!=null ) {
			qry = qry + "#" + hash;
		}
		if(qry.startsWith("#")) 
			window.location = qry;
		else	
			window.location.search = qry;
	}
	
	this.stringifyParams = function( args ) {
		var qry = "";
		for(var k in args) {
			if(qry!="") qry += "&";
			qry += k+"="+escape( args[k] );
		}
		return qry;
	}

	
	
	//this is to be deprecated just in case there is something referencing this
	this.loadOld = function( page, target, options ) {
		$( "#"+target ).load(page, function() {
			BindingUtils.load( "#"+target);
		});
    }

    this.getParameter = function( name ) {
	  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
	  var regexS = "[\\?&]"+name+"=([^&#]*)";
	  var regex = new RegExp( regexS );
	  var results = regex.exec( window.location.href );
	  if( results == null )
		return "";
	  else
		return decodeURIComponent(results[1].replace(/\+/g, " "));
	}

	this.getParameters = function(qryParams) {
		var params = this.parseParameters( window.location.href.slice(window.location.href.indexOf('?') + 1) );
		if( qryParams !=null ) {
			for(var n in qryParams ) {
				if( (typeof qryParams[n] != "function") && (typeof qryParams[n]!="object") ) {
					params[n] = qryParams[n];
				}
			}
		}
		return params;
	}
	
	//this will retrieve all parameters including hidden parameters.
	this.getAllParameters = function(selector) {
		var f = this.getParameters();
		if(f==null) f = {};
		if( selector ) {
			$("input[type='hidden'][context!='']", selector).each(function(i,elm){
				var name = R.attr(elm, 'name');
				if( name ) {
					f[name] = $get(R.attr($(elm), 'context')).get( name );
				}
			});
		}
		return f;
	}
	
	this.parseParameters = function( str ) {
		var vars = {}, hash;
		var hashes = str.split('&');
		for(var i = 0; i < hashes.length; i++)
		{
			hash = hashes[i].split('=');
			vars[hash[0]] = this.getParameter(hash[0]);
		}
		return vars;
	}
	
	this.buildHash = function(hash, params) {
		if(params==null) return hash;
		return hash + "?" + this.stringifyParams(params);
	}
	
	this.loadHash = function(hashid, params ) {
		this.reload( null, this.buildHash(hashid, params) );
    }	
	
};

var AjaxStatus = function( msg ) {
	var div = $('<div class="ajax-status" style="position:absolute; z-index:300000"></div>')
	 .html( msg )
	 .hide();

	$(function(){ div.appendTo('body'); });

	this.show = function() {
		position();
		div.show();
	};

	this.hide = function() {
		div.hide('fade');
	};

	function position() {
		div.css({
			'top': '0px', 'left': '0px'
		});
	}
};

$(function(){
	//var ajxStat = new AjaxStatus('Processing ...');
	//$(document).ajaxStart( ajxStat.show ).ajaxStop( ajxStat.hide );
});

var Registry = new function() {

    this.invokers = [];
	var index = {}

	this.add = function( o ) {
		this.invokers.push( o );
		if(o.id) index[o.id] = o;	
	}
	
	this.lookup = function( typename ) {
		return this.invokers.findAll(  function(o) {  return o.type == typename }  );
	}	
	
	this.find = function(id) {
		return index[id];
	}
	
};

var Hash = new function() {

	var self = this;
	this.target = "content";
	
	this.handlers = {}
	
	this.init = function(defaultHash, containerId) {
		$(window).bind( "hashchange", function() {
			self.loadContent();
		});
		if ( window.location.hash ) {
			self.loadContent();
		} else if(defaultHash) {
            window.location.hash = defaultHash;
        } 

        if (containerId != null) {
        	var menucontainer = $('#'+containerId);
        	var menuactions = menucontainer.find('tr td.menuitem > a');
        	var menuitems = menuactions.parent(); 
        	menuitems.removeClass('menuitem-selected').removeClass('menuitem-unselected');
        	menuitems.addClass('menuitem-unselected');        	
    		menuactions.click(function(event){
    			var $e = $(this);
    			if ($e.attr('href') == '#') return; 

    			event.preventDefault();
    			window.location.href = $e[0].href;
    			if ($e[0].href == window.location.href) {
	    			var $p = $e.closest('.hashmenu');
	    			$p.find('tr td.menuitem-selected').removeClass('menuitem-selected').addClass('menuitem-unselected'); 
	    			$e.parent().removeClass('menuitem-unselected').addClass('menuitem-selected'); 
    			} 
    		});

    		if (window.location.hash) {
    			var hashid = window.location.hash;
    			var parent = menucontainer.find('td.menuitem a[href='+hashid+']').parent(); 
    			if (parent[0]) parent.removeClass('menuitem-unselected').addClass('menuitem-selected');
    		}
        }
	} 
	
	this.navigate = function( id, params ) {
		var hash = id;
		if(params!=null) {
			hash = hash + "?" + WindowUtil.stringifyParams( params );
		}
		window.location.hash = hash;
	}
	
	this.reload = function( params ) {
		var hash = window.location.hash.substring(1);
		var hashparam;
		if( hash.indexOf("?") > 0 ) {
			var arr = hash.split("?");
			hash = arr[0];
			hashparam = arr[1];
		}
		if(params) {
			hash = hash + "?" + WindowUtil.stringifyParams(params);
		}
		if(hashparam) {
			hash += (params?'&':'?') + hashparam;
		}

		if( window.location.hash == '#' + hash )
			$(window).trigger('hashchange');
		else
			window.location.hash = hash;
	}
	
	
	this.loadContent = function() {
		var hash = window.location.hash.substring(1);
		var params = null;
		if( hash.indexOf("?") > 0 ) {
			hash = hash.split("?");
			params = WindowUtil.parseParameters( hash[1] );
			hash = hash[0];
		}
		if(hash=="") return;
		var inv = Registry.find(hash);
		if(inv==null)
			throw new Error("hash " + hash + " is not registered" );
		if( !inv.page) return;	

		//store all params in query parameters to be sent to the server
		var qryParams = WindowUtil.getAllParameters();
		for(var n in params) {
			qryParams[n] = params[n];	
		}
		
		//load the page into the target content
		var content = $('#'+this.target);
		content.css('opacity',0).load(inv.page, qryParams, function(response,textStatus) {
                        if(textStatus == "error") {
                            window.location.href = response;
                        }

			var controller;
			
			try{ controller = $get(inv.context); }
			catch(e){ 
				if(window.console && R.DEBUG)
					console.log(e); 
			}
			
			//attach the bookmark;
			if( controller ) {
				controller.bookmark = self;
				if(params!=null) {
					for( var key in params ) {
						try{ $ctx(inv.context)[key] = params[key]; }catch(e){;}
					}
				}
				if( inv.parent ) {
					controller.container = {
						close :  function() { self.navigate(inv.parent); },
						refresh: function() { controller.refresh(); },
						reload : function() { self.reload(); }
					}
				}
				else {
					controller.container = {
						close :  function() { },
						refresh: function() { controller.refresh(); },
						reload : function() { self.reload(); }
					}
				}
			}

			BindingUtils.load( content );
			content.css('opacity',1);
		});
		
		//pass the registered object (based on hashkey) and the parameters passed
		for(var n in this.handlers ) {
			this.handlers[n](inv, params);
		}
	}
}

//OPENERS
//******************************************************************************************************************
// type of openers...
//req. Opener must have an interface
//  classname = 'opener'
//  load();
//******************************************************************************************************************
//basic Opener

function Opener(id, params) {
	this.classname = "opener";
	this.id = id;
	this.params = params;
	if( id.indexOf(".")>0) {
		this.page = id;
	}
	else {
		var inv = Registry.find(id);
		this.page = inv.page;
	}
}


/**
 * This is the opener used to open a popup dialog
 * You can set global options using:
 *   PopupOpener.options = {}
 * the value of PopupOpener.options is global unless explicitly overriden
 */
function PopupOpener( id, params, options ) 
{
    this.classname = "opener";
	this.id = id;
    this.params = params;
	this.caller;
	this.parentTarget;
	this.title;
	this.source;
	this.options = options || {};

	var defaultOptions = {show: 'fade', hide: 'fade', height: 'auto'};
	
	//merge values of PopupOpener.options if specified
	if( PopupOpener.options )
		$.extend(defaultOptions, PopupOpener.options);


    this.load = function() {
		var inv = Registry.find(this.id);
		if (inv==null) { 
			alert( this.id + " is not registered", "Error" );
			return;
		}
        var n = inv.context;
		var page = inv.page;
        var p = this.params;
		var caller = this.caller;

		var dynamic = !this.id.startsWith('#');
		var	div;
		if ( dynamic )
			div = $('<div></div>').hide().appendTo('body');
		else
			div = $(this.id);

			
		var options = $.extend({},defaultOptions);
		//remove div if dynamically created
		if (dynamic) options.close = function() { div.remove(); }
		
		if (!options.resizable) options.resizable = false; 
		if (!options.modal) options.modal = true; 

		options.title = this.title || inv.title;

		if ( inv.options ) $.extend(options, inv.options);
		$.extend(options, this.options);

		if ( dynamic )
			div.load(page, WindowUtil.getParameters(p), function(result, statustext, xml){ 
				createDialog(); 
			});
		else
			createDialog();
		
		function createDialog() { 
			/* attach a close-action button on the upper-right corner, overlapping the jquery's default close-action button */
			var strCloseAction = '<a class="rui-dialog-close-action" href="#" onclick="return RUI.closeDialog(this);" style="text-decoration:none;"><span class="rui-icon rui-icon-close"/></a>'; 
			div.append($(strCloseAction)); 

			try {
				if(p!=null) {
					for( var key in p ) {
						try{ $ctx(n)[key] = p[key]; }catch(e){;}
					}
				}
				$ctx(n)._caller = caller.code;
				$get(n).container = {
					element: div,
					close: function() { 
						div.dialog("close"); 
						div.remove();
						try { 
							if (caller) caller.refresh(); 
						} catch(e) { 
							alert(e);  
						} 
					},
					refresh: function() { $get(n).refresh(); }
				};	
			}
			catch(e) {;}
			
            //make a dialog after the content is loaded.
			options.close = function(e) { 
				try { div.remove(); } catch(e) {;} 
				
				dialogAdapter('CLOSED',e); 
			} 
			options.beforeClose = function(e) { 
				var result = dialogAdapter('BEFORE_CLOSE',e); 
				return (result==false)? false: true; 
			} 
			
			options.buttons = {
				"Button1": function(){
					$(this).dialog('close'); 
				},
				"Button2": function(){
					$(this).dialog('close'); 
				}
			} 

			options.buttons = null;
            div.dialog(options);
			BindingUtils.load(div); 

			var uidialog = RUI.decorateDialog(div);				
			if (uidialog) {
				var user_defined_titlebar = uidialog.find('.rui-dockable-popupopener-titlebar')[0];
				if (user_defined_titlebar) {
					var uidialog_titlebar = uidialog.find('.ui-dialog-titlebar')[0]; 
					if (uidialog_titlebar) {
						RUI.dockElementTo(user_defined_titlebar, uidialog_titlebar);
						$(uidialog_titlebar).addClass('popupopener-titlebar');
					} 
				} 
			
				uidialog.find('.rui-dockable-container').each(function(idx,item){ 
					if (item) { 
						var o = $(item); 
						if (R.attr(o,'dockTo')) RUI.dockElement(o, div); 
					} 
				});

				uidialog.css('padding-bottom', '1px'); 
				uidialog.find('.ui-dialog-buttonpane').hide();
				if (options.headless == true) {
					uidialog.find('.ui-dialog-titlebar').hide(); 
					uidialog.find('.rui-dialog-close-action').hide(); 
				} 
			} 
		} 
		
		function dialogAdapter(mode, evt) {
			var context = null; 
			try { 
				context = $ctx(n); 
			} catch(e) { 
				return true; 
			} 
			
			if (mode == 'CLOSED') 
				return (context.onclose)? context.onclose(): true; 
			else if (mode == 'BEFORE_CLOSE') 
				return (context.onbeforeClose)? context.onbeforeClose(): true; 
			else 
				return true; 
		} 		
    }
}


/**
 * DropdownOpener class
 *
 * This is the opener used to open a dropdown window
 * You can set global options using:
 *   DropdownOpener.options = {}
 * the value of DropdownOpener.options is global unless explicitly overriden
 */
(function()
{		
	var defaultConfig = { my: 'left top', at: 'left bottom' };	
	var positionNames = {
		'bottom-left' : { my: 'left top', at: 'left bottom' },
		'bottom-right' : {my: 'right top', at: 'right bottom'},
		'top-left' : { my: 'left bottom', at: 'left top' },
		'top-right' : { my: 'right bottom', at: 'right top' }
	};
	
	
	function DropdownOpener( id, params, options ) 
	{
		this.classname = "opener";
		this.caller;
		this.id = id;
		this.params = params;
		this.title;
		this.source;
		this.options = options || {};
		
		var dwindow;
		
		this.load = function() {
			if( dwindow && this.source == dwindow.getSource() && dwindow.show() ) return;
			
			var inv = Registry.find(this.id);
			if(inv==null) {
				alert( this.id + " is not registered", "Error" );
				return;
			}
			var n = inv.context;
			var p = this.params;
			var caller = this.caller;
			var page;
			if( this.id.startsWith('#') )
				page = $(this.id);
			else
				page = inv.page;
			
			var options = $.extend({}, DropdownOpener.options);
			if( inv.options ) $.extend(options, inv.options);
			$.extend(options, this.options);
			
			dwindow = new DropdownWindow(this.source, options);
			dwindow.show( page, WindowUtil.getParameters(p), function(div) {
				if( n!=null ) {
					if(p!=null) {
						for( var key in p ) {
							try{ $ctx(n)[key] = p[key]; }catch(e){;}
						}
					}
					$ctx(n)._caller = caller.code;
					BindingUtils.load( div );
					$get(n).container = {
						element: dwindow.getElement(),
						close:   function() { dwindow.close(); if(caller) caller.refresh() },
						refresh: function() { $get(n).refresh(); }
					}
				}
			});
		};
	}//-- end of DropdownOpener
	
	//--- DropdownWindow class ----
	function DropdownWindow( elem, options ) {

		var source = $(elem);
		var div = $('<div class="dropdown-window" style="position: absolute; z-index: 1000; top: 0; left: 0;"></div>');
		var dynamic = false;
		
		if( options.styleClass ) div.addClass( options.styleClass );
		if( options.resizable )  div.resizable();
		
		this.show = function( page, params, callback ) {
			var reshow = arguments.length == 0;
			if( reshow ) {
				div.stop();
				if( div.is(":hidden") ) return false;
			}

			//if options.position is string, it should be one of the positionNames key
			if( typeof options.position == 'string' ) {
				if( positionNames[options.position] ) {
					options.position = positionNames[options.position];
				}
				else {
					options.position = null;
				}
			}
			
			var posConfig = {};
			$.extend(posConfig, defaultConfig, options.position);
			posConfig.of = source;

			if( !reshow ) {
				dynamic = (typeof page == 'string');
				if( dynamic ) {
					div.hide().load( page, params, initDailog);
				}
				else {
					page.show();
					div.append(page);
					initDailog();
				}
			}
			else {
				div.animate({height: div.data('height')},200);
				bindWindowEvt();
				return true;
			}
			
			//-- show helper
			function initDailog(){
				div.insertAfter(posConfig.of)
				 .position( posConfig )
				 .show();
				 
				var h = div[0].offsetHeight;
				div.data('height',h).css('height',0).animate({height: h},200);

				bindWindowEvt();
				callback(div);
				if( options.handleClassOnOpen ) source.addClass(options.handleClassOnOpen);
				if( options.onShow ) options.onShow( div );
			}
		};
		
		this.getElement = function() { return div; }
		this.close = function() { hide(); };
		this.getSource = function() { return source[0]; }
		
		function hide() {
			div.animate({height: 0}, 200, function() {
				if( !dynamic ) {
					var ch = $(this).children().hide().remove();
					ch.insertAfter(this);
				}
				$(this).remove();
				if( options.handleClassOnOpen ) source.removeClass(options.handleClassOnOpen);
				if( options.onClose ) options.onClose( this );
			});
			$(document).unbind('mouseup', onWindowClicked);
		}

		function bindWindowEvt() {
			$(document).bind('mouseup', onWindowClicked);
		}

		function onWindowClicked(evt) {
			var target = $(evt.target).closest('div.dropdown-window');
			if( target.length == 0 ) {
				hide();
			}
		}

	}//-- end of DropdownWindow class
	
	//make the classes visible globally
	window.DropdownOpener = DropdownOpener;
	DropdownOpener.DropdownWindow = DropdownWindow;

})();

//load binding immediately
$(document).ready (
    function() {
        BindingUtils.load();
		Hash.init();
		Scroller.init();
    }
);

//important keyword shortcuts used by the programmer
function $get( name ) { return ContextManager.get(name); };
function $put( name, code, pages ) {return ContextManager.create( name, code, pages );};
function $ctx(name) {return ContextManager.get(name).code;};
function $load(func) {  BindingUtils.loaders.push(func); };
function $register( config ) { Registry.add(config); };

//scroller manager
var Scroller = new function(){

	var globalListners = []; //array
	var localListeners = {}; //map of id(hashid) and listener array pair
	
	this.init = function() {
		$(function(){
			$(window).scroll(function() {
				if  ($(window).scrollTop() == $(document).height() - $(window).height()){
				   Scroller.onScrollToBottom();
				}
			});
		});
	}

	/**
	 * @param listener
	 *		the callback function
	 * @param hashid
	 *		optional, if you pass an id(hashid), the listener will be treated as a local listener for a particular hashid
	 */
	this.register = function( listener, hashid ) {
		if( !hashid ) {
			if( $.inArray( listener, globalListners ) >= 0 ) return;
			globalListners.push( listener );
		}
		else {
			if( !(localListeners[hashid] instanceof Array) )
				localListeners[hashid] = [];

			if( $.inArray( listener, localListeners[hashid] ) >= 0 ) return;
			localListeners[hashid].push(listener);
		}
	}
	
	/**
	 * @param listener 
	 *		if no hashid passed, it will look for the listener passed on the globalListners and removes it
	 * @param hashid
	 *		optional, if a hashid is passed, it will look for the listener passed on the localListeners and removes it
	 */
	this.unregister = function( listener, hashid ) {
		if( !hashid ) {
			globalListners.remove( listener );
		}
		else {
			if( localListeners[hashid] ) localListeners[hashid].remove( listener );
		}
	}
	
	this.onScrollToBottom = function() {
		for(var i=0; i<globalListners.length; ++i) globalListners[i]();
		
		var currentHash = location.hash.length > 1 ? location.hash.substring(1) : '';
		if( !currentHash ) return;
		
		for(var i in localListeners) {
			if( i != currentHash ) continue;
			if( localListeners[i] && localListeners[i].length == 0 ) continue;
			for(var j=0; j<localListeners[i].length; ++j) {
				localListeners[i][j]();
			}
		}
	}
	
};


/*
 * @author		jaycverg
 * description	themable implementation of message box
 */
var MsgBox = {
	/*
	 * interfaces:
	 *  - MsgBox.alert(msg, callback, options)
	 */
	"alert": function(msg, callback, options) {
		if (!options) options = {};
		if (!options.title) options.title = 'Information';
		
		options.url = '/msgbox/information';
		options['msgbox:status']='1';
		
		MsgBox.showDialog(msg, options, function(div){ 
			if (callback) callback(); 
		}); 
	},
	/*
	 * interfaces:
	 *  - MsgBox.error(msg, callback, options)
	 */
	"error": function(msg, callback, options) {
		if (!options) options = {};
		if (!options.title) options.title = 'Error';
		
		options.url = '/msgbox/error';
		options['msgbox:status']='1';
		
		MsgBox.showDialog(msg, options, function(div){ 
			if (callback) callback(); 
		}); 		
	},
	/*
	 * interfaces:
	 *  - MsgBox.confirm(msg, callback, options)
	 */
	"confirm": function(msg, callback, options) { 
		if (!options) options = {};
		if (!options.title) options.title = 'Confirmation';
		
		options.url = '/msgbox/confirm';
		
		MsgBox.showDialog(msg, options, function(div){ 
			if (callback) callback(); 
		}); 
	},	
	/*
	 * interface:
	 *  - MsgBox.prompt(msg, callback, options)
	 */	
	"prompt": function(msg, callback, options) { 
		if (!options) options = {};
		if (!options.title) options.title = 'Prompt';
		
		options.url = '/msgbox/prompt';
		
		MsgBox.showDialog(msg, options, function(div){
			if (callback) {
				var fld = div.find('#msgbox-prompt-field')[0];
				if (fld) {
					var fldvalue = $(fld).val(); 
					if (fldvalue != null && fldvalue.length == 0) fldvalue = null; 
					
					callback(fldvalue);
				}
			} 	
		}); 
	},
	
	"showDialog": function(msg, options, handler) {
		$('#msgbox-container').remove(); 

		if (msg) 
			msg = msg.replace(/\n/g, '<br/>');
		else
			msg = '';
		
		if (!options['msgbox:status']) options['msgbox:status']='0';
		
		var div = $('<div id="msgbox-container"></div>').hide().appendTo('body');
		div.attr('msgbox:status', options['msgbox:status']); 

		var url = options.url;		
		var loadHandler = function(){
			var lbl = div.find('#msgbox-label')[0];
			if (lbl) $(lbl).html(msg);  
		
			if (!options.width) options.width = 'auto';
			
			options.title = options.title||'Information';
			options.resizable = false;
			options.modal = true;
			options.close = function() { 
				div.remove(); 
			
				try { 
					if (div.attr('msgbox:status') == '1') {
						if (handler) handler(div); 
					} 
				} 
				catch(e) { 
					alert(e); 
				} 
			}; 
						
			div.dialog(options); 
			BindingUtils.load(div); 
			
			var uidialog = RUI.decorateDialog(div);
			if (uidialog) uidialog.addClass('rui-msgbox'); 
		};	
		div.load(url, {}, loadHandler); 	
	}, 
	
	/* msgbox actions */
	"close": function(elem) {
		var container = $(elem).closest('#msgbox-container'); 
		if (container) container.dialog("close"); 
		 
		return false; 	
	},  
	
	"approve": function(elem) {
		var container = $(elem).closest('#msgbox-container'); 
		if (container) 
		{
			container.attr('msgbox:status', '1'); 
			container.dialog("close"); 
		} 
		return false; 	
	} 	
};

/**
 * @author	jaycverg <jaycverg@gmail.com>
 * depends	jquery.1.4.+
 * @param	selector		- a valid jquery selector
 * @param	orientation		- a string value of either 'left', 'top',  'right', or 'bottom'
 * 							- default is 'bottom'
 * @param	offset			- an object to specify either the offsetX and offsetY of the element
 *							- fields are x and y (i.e., offset.x = -1)
 */


function InfoBox(selector, orientation, offset, delay) 
{
	var infobox;
	var _this = this;
	
	this.offset = offset;
	this.delay = delay;
	
	this.show = function(elem) {
		if($(elem).data('_infobox_attached')) return;
		
		if(!infobox) infobox = $(selector);
		var delay = this.delay? this.delay : 500; //millis
		$(elem).mouseover(function() {
			if( $(elem).data('info') ) return;
			
			var ib = infobox.clone(true).removeAttr('id').insertAfter(infobox).addClass('infobox');
			var css = position(elem);
			ib.mouseout(function(e){ 
				if(e.relatedTarget == this || e.relatedTarget == elem || $(e.relatedTarget).parents('.infobox')[0] == this ) return;
				hide($(this),$(elem));
			});
			$(elem).data('info', ib);
					
			var timeid = setTimeout(
				function() {
					ib.show().css(css);
					if(window.BindingUtils) BindingUtils.bind(null, ib);
				}, delay
			);
			$(elem).data('timeid', timeid);
		})
		.mouseout(function(e){
			var ib = $(elem).data('info');
			if( ib && (ib[0] == e.relatedTarget || $(e.relatedTarget).parents('.infobox')[0] == ib[0] )) return;
			if( ib ) {
				hide(ib, $(elem));
			}
		})
		.data('_infobox_attached', true)
		.trigger('mouseover');
	};
	
	function hide(ibox, elem) {
		ibox.remove();
		elem.removeData('info');
		var timeid = elem.data('timeid');
		clearTimeout(timeid);
	}
	
	function position(elem) {
		var b, css;
		var loc = getLocation(elem);
		
		var ibw = infobox.outerWidth();
		var ibh = infobox.outerHeight();
		var ew = $(elem).outerWidth();
		var eh = $(elem).outerHeight();
		var wh = $(window).height();
		var ww = $(window).width();
		
		if( orientation == 'left' ) {
			css = {left:loc.x - ibw + 1, top:loc.y};
		}
		else if( orientation == 'top' ) {
			css = {left:loc.x, top:loc.y - ibh - eh + 1};
		}
		else if( orientation == 'right' ) {
			css = {left:loc.x + ew - 1, top:loc.y};
		}
		else {
			css = {left:loc.x, top:loc.y + eh - 1};
		}
		
		if( _this.offset && _this.offset.x ) css.left += _this.offset.x;
		if( _this.offset && _this.offset.y ) css.top += _this.offset.y;	
		
		return css;
	}
	
	function getLocation(e) {
		var x=0,y=0;
		while(e) {
			x+=e.offsetLeft;
			y+=e.offsetTop;
			e = e.offsetParent;
		}
		return {x:x, y:y};
	}
}



/**
 * @author			jaycverg <jaycverg@gmail.com>
 * @description		server side utility for rameses-ui library
 */
 
function $invoke( url, params, callback, type ) {
	$.ajax({
		url: url,
		data: params,
		type: type || 'post',
		complete: callback
	});
}


var RUI = { 
	"closeDialog": function(elem) { 
		var container = $(elem).closest('.ui-dialog-content'); 
		if (container) container.dialog("close"); 
		 
		return false; 	
	}, 
	"decorateDialog": function(div, options) {
		if (!options) options = {};
		
		/* get the ui-dialog container */
		var parent = div.closest('.ui-dialog')[0]; 			
		if (parent) 
		{	
			var uidialog = $(parent); 
			/* hide the jquery's default close-action button */
			uidialog.find('.ui-dialog-titlebar-close').hide();
			
			/* inject rui css to the jquery dialog */
			uidialog.addClass('rui-theme-font rui-theme-background rui-popupopener'); 
			
			var uide = uidialog.find('.ui-dialog-titlebar')[0]; 
			if (uide) $(uide).addClass('rui-theme-header-background');
			
			uide = uidialog.find('.ui-dialog-content')[0]; 
			if (uide) $(uide).addClass('rui-popupopener-body');
			
			return uidialog; 
		} 
	},
	"initDockableElement": function(elem) {
		var $e = $(elem);
		var dockTo = R.attr($e, 'dockto');
		if (!dockTo) return null; 
		
		$e.hide();
		$e.addClass('rui-dockable-container'); 
		$e.addClass('rui-dockable-'+dockTo); 
		return $e;
	},
	"dockElementTo": function(sourceElem, targetElem) {
		var $source = $(sourceElem);
		$source.hide(); 
		
		var dockTo = R.attr($source, 'dockTo');
		var $target = $(targetElem);
		$target.html("");
		$target.append($source); 
		$target.show();
		$source.show(); 
		$source.removeAttr('r:dockTo'); 
		$source.removeClass('rui-dockable-container'); 
		$source.removeClass('rui-dockable-'+dockTo); 
		$('.'+dockTo+'-parent').each( 
			function(idx,item) { 
				$(item).show(); 
			} 
		); 
	}, 
	"dockElement": function(elem, rootElement) {
		var $e = RUI.initDockableElement(elem);
		if (!$e) return; 
		
		var dockTo = R.attr($e, 'dockto');
		
		/* get the docking container */
		var found = false; 
		var dockNow = function(container) { 
			if (!container) return;
			if (found == true) return; 
			
			var docking_container = $(container); 
			docking_container.html(""); 
			docking_container.append($e);  
			$e.show(); 
			$e.removeAttr('r:dockto'); 
			$e.removeClass('rui-dockable-container'); 
			$e.removeClass('rui-dockable-'+dockTo); 
			$e.closest('.'+dockTo+'-parent').show(); 
			found = true; 
		} 
		
		if (rootElement) { 
			var container; 
			$(rootElement).find('#'+dockTo).each(function(idx,item){ 
				if (item) container = item; 
			}); 
			dockNow(container); 
		} 
		
		if (!found) { 
			var container; 
			$('#'+dockTo).each(function(idx,item){ 
				if (item) container = item; 
			}); 
			dockNow(container); 
		} 
	}, 
	"createSideMenu": function() {
		var tdnodes = $('.rui-sidemenu tr td'); 
		if (tdnodes)
		{
			var found = false;
			var preferredDivNode;
			for (var i=0; i<tdnodes.length; i++) {
				var tdnode = tdnodes[i];				
				var elem = $(tdnode);
				var isMenuGroup = elem.hasClass('menugroup'); 
				
				elem.addClass('menuitem');
				if (isMenuGroup) 
				{
					elem.removeClass('menugroup');
					elem.addClass('menugroup'); 
				} 
				
				if (!elem.children('.menuitem')[0]) 
				{
					var s = '';
					/*
					if (!elem.children('.gap')[0])
					{
						s = elem.html();
						elem.html(s+'<div class="gap"></div>');
					} */
					
					s = elem.html();
					elem.html('<div class="menuitem">'+s+'</div>');
				} 
				
				var divNode = $(elem.children('div.menuitem'));
				if (!preferredDivNode && !isMenuGroup) preferredDivNode = divNode;
				
				var aNode = $(elem.find('div.menuitem a'))[0];
				if (aNode) 
				{
					var aNode_e = $(aNode);  
					if (aNode_e.attr('href') == window.location.hash) 
					{
						divNode.addClass('selected');
						found = true;
					} 
					aNode_e.click(function(e) { 
						$(this).closest('.rui-sidemenu').find('div.menuitem').each(function(){
							$(this).removeClass('selected'); 
						});
						$(this).parent().addClass('selected');
						return true; 
					});
				} 
			} 
			
			if (!found && preferredDivNode) {
				var sidemenubar = preferredDivNode.closest('.rui-sidemenu');
				if (!sidemenubar.hasClass('rui-sidemenu-autoselect-off')) 
					preferredDivNode.addClass('selected');
			} 
		} 
	} 	
};

var Inv = new function() {
	this.showOpener = function(elem) {
		var $e = $(elem);
    	var target = R.attr($e, "target");
    	var hashid = R.attr($e, "hashid");
    	if (target && hashid) {
	    	var opener = null; 
	    	if (target == 'popup') { 
	    		opener = new PopupOpener(hashid); 
	    	} else {
	    		return; 
	    	}

	    	var controller = $get("default-controller-impl"); 
	    	controller.navigate(opener); 
    	}
	}
}

$put("default-controller-impl", new function(){}); 
