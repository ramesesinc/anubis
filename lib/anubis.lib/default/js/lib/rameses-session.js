var Socket = new function() {

    function HttpSocket ( channel ) {
        if (!channel) {
            alert('channel must be provided!');
            throw new Error('channel must be provided!');
        }	

        var self = this;
        var _channel = channel;
        var _token =  Math.floor(Math.random()*1000000001);

        this.handlers = {};
        this.error;

        var poll = function() { 
			try {
				$.ajax({ 
					url: "/poll/"+_channel+"/"+_token, 
					dataType: 'text',
					cache: false, 
					complete: function(o,textStatus) {
						if (o.statusText == 'OK' ) {
							var result = null;
							if (o.responseText) { 
								try { 
									result = $.parseJSON(o.responseText); 
								} catch(e) {
									if (window.console) window.console.log("ERROR parsing caused by " + e + " responseText->" + o.responseText); 
								} 
							}  
							if (result) { 
								for( var n in self.handlers ) {
									try {
										self.handlers[n]( result );
									} catch(e){;}
								} 
							} 
							poll();
						} 
					} ,
					error: function(o,textStatus,msg) {
						if(textStatus=="timeout") {
							poll();
						} else {
							if( self.error ) {
								self.error( o );
							} else {
								if( window.console ) window.console.log( "Error in polling. " + o.error);
								//reconnect after 30 seconds
								setTimeout( poll, 30000 );
							}    
						}
					}
				});
			} 
			catch(e) { 
				if (window.console) window.console.log("[ERROR]_poll caused by " + e); 
			} 
        } 
        
        this.start = function(){
            poll();
        } 
    } 

    this.create = function( channel ) {
        var socket = new HttpSocket( channel );
        return socket;
    }
} 
