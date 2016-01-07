//Script for index html
//by Kent-Na

(function($){

	//Connect to server
	//Execute this before document_ready to save a time.
	var url = "ws://rcp.tuna-cat.com:5001/rcp";
	var is_document_ready = false;
	var rcpConnection = null;
 	{
		var rcpConnection = rcpJS.rcpConnection();
		rcpConnection.onopen = function(){
			$("#server_status").text("online");
			//rcpConnection.sendOpen();
		}
		rcpConnection.onerror= function(e){
			$("#last_error").text(
				"error code(" + e.code + ")");
		}
		rcpConnection.onclose= function(e){
			$("#server_status").text(
				"reconnecting server");
			//setTimeout(function(){
				//rcpConnection.connectToURL(url);
				//}, 3000);
		}

		//Wait untill UI is done.
		rcpConnection.context.pause_execute_command();
		rcpConnection.connectToURL(url);
	}

	//Define custom tags for uploader.
	jQuery.fn.uploader_tags = function(){
		var re1 = /\[img:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]/g;
		var pattern1 = '<img src="http://static.tuna-cat.com/$1 />">'
		var re2 = /\[file:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]/g;
		var pattern2 = '<a href="http://static.tuna-cat.com/$1">$1</a>'
		return this.each(function(){
				$(this).html(
					$(this).html()
						.replace(re1, pattern1)
						.replace(re2, pattern2)
				)
		})
	}

	//List element object bind a JSON node with a DOM node.
	var list_elements= [];
	function ListElement(index){
		var element = {};
		element.index = -1;
		element.is_edit_view = false;
		element.dom_element = null;
		
		function get_json_element(){
			if (element.index == -1)
				return null;
			return rcpConnection.context.json_value_at([element.index]);
		}

		function setup_as_view(){
			var box = $("#element_box_template")
				.clone()
				.appendTo("#list_container")
				.removeAttr("id")
				.attr("class", "element_box");
			element.dom_element = box[0];
		}
		function setup_as_editor(){
			var box = $("#edit_element_box_template")
				.clone()
				.appendTo("#list_container")
				.removeAttr("id")
				.attr("class", "edit_element_box");
			element.dom_element = box[0];
		}
		function sync_as_view(){
			var json_element = get_json_element();
			var dom_element = element.dom_element;
			var j_element = $(dom_element);

			j_element.children(".element_post_time")
				.text(json_element.post_time);
			j_element.children(".element_handlename")
				.text(json_element.handlename);
			j_element.children(".element_message_body")
				.text(json_element.message_body).uploader_tags();
			j_element.children(".edit_button")
				.click(function(){
						element.to_editor();
				});
		}
		function sync_as_editor(){
			var json_element = get_json_element();
			var dom_element = element.dom_element;
			var j_element = $(dom_element);
			var index = element.index;

			j_element.children(".edit_handlename")
				.val(json_element.handlename);
			j_element.children(".edit_message_body")
				.val(json_element.message_body);
			function done_editing(){
				//Sync edit to remote.

				//Make deep copy first to keep extra 
				//information added by something other.
				//fixme: Replace this with begin-end.
				var old_json_element = get_json_element();
				var new_json_element = 
					$.extend(true, {}, old_json_element);
				new_json_element.handlename = 
					j_element.children(".edit_handlename").val();
				new_json_element.message_body = 
					j_element.children(".edit_message_body").val();

				rcpConnection.context.request_set(
					[index], new_json_element);

				//Change view mode.
				element.to_view();
			}
			j_element.children(".edit_handlename")
				.focus(function(){
					rcpConnection.ping();
				});
			j_element.children(".edit_message_body")
				.focus(function(){
					rcpConnection.ping();
				});
			j_element.children(".delete_button")
				.click(function(){
					rcpConnection.context.request_splice(
						[], [], index, index+1);
				});
			j_element.children(".done_button").click(done_editing);
			j_element.children(".edit_message_body")
				.keydown(function(e){
					if (e.keyCode === 13 && e.shiftKey){
						done_editing()
					}
				});
			j_element.children(".cancel_button")
				.click(function(){
						//Change view mode.
						element.to_view();
				});
		}

		element.update_index = function(new_index){
			element.index = new_index;
		}
		element.sync = function(index){
			element.index = index;
			if (element.is_edit_view){
				if (element.dom_element == null) 
					setup_as_editor();
				sync_as_editor();
			}
			else{
				if (element.dom_element == null) 
					setup_as_view();
				sync_as_view();
			}
			return element.dom_element;
		}
		element.remove = function(){
			$(element.dom_element).remove();
		}

		//Change DOM to editmode.
		element.to_editor = function(){
			var old_dom = element.dom_element;
			setup_as_editor();
			sync_as_editor();

			var new_dom = element.dom_element;
			$(old_dom).replaceWith($(new_dom));
		}
		//Change DOM to view mode.
		element.to_view = function(){
			var old_dom = element.dom_element;
			setup_as_view();
			sync_as_view();

			var new_dom = element.dom_element;
			$(old_dom).replaceWith($(new_dom));
		}

		return element;
	}

	//
	rcpConnection.context.did_execute_command = function(command){
		var context = rcpConnection.context;
		var contents = context.local_site.state.contents.root;

		if (command.type == CommandType.Set && 
				command.path.length == 0){
			//Reset everything.
			$("#list_container > .element_box").remove();
			$("#list_container > .edit_element_box").remove();

			list_elements = [];
			for (var key = 0; key<contents.length; key++){
				var index = key;
				var list_element = ListElement(key);
				list_elements.push(list_element);
				var dom_element = list_element.sync(index);
				$(dom_element).appendTo("#list_container");
			}
		}
		else if(command.type == CommandType.Splice && 
				command.path.length == 0){
			//Add message to list.
			var new_list_elements = [];
			var begin = command.begin;
			var end = command.end;
			var new_end = begin+command.value.length;

			var DOM_insert_target = $("#end_of_list");
			if (begin < list_elements.length){
				DOM_insert_target = list_elements[begin].dom_element;
			}

			//Setup new elements.
			for (var index = begin; index<new_end; index++){
				var new_list_element = ListElement(index);
				new_list_elements.push(new_list_element);
				var dom_element = new_list_element.sync(index);
				$(dom_element).insertBefore(DOM_insert_target);
			}

			//Remove old DOM elements.
			for (var index = begin; index<end; index++){
				list_elements[index].remove();
			}

			list_elements = list_elements.slice(0, begin).
				concat(new_list_elements, list_elements.slice(end));

			//Update indexes
			if (end != new_end){
				for (var index = new_end; 
						index<list_elements.length; index++){
					list_elements[index].update_index(index);
				}
			}
		}
		else{
			//Update the message.
			var index = command.path[0];
			list_elements[index].sync(index);
		}
	}

	$(document).ready(function(){
		$("#server_url").text(url);

		rcpConnection.context.unpause_execute_command();

		$("#force_store").click(function(){
			rcpConnection.force_store();
			//rcpConnection.create_context();
		});
		$("#reset").click(function(){
			rcpConnection.context.
				request_set([], []);
		});
		var tmp = null
		$("#to_local").click(function(){
			tmp = rcpConnection.context.store()
			console.log(tmp)
			//var body = new ArrayBuffer(0);
			//rcpConnection.sendCommand(0x7e, body);
		});
		$("#to_server").click(function(){
			console.log(tmp)
			tmp = rcpConnection.context.load()
			//var body = new ArrayBuffer(0);
			//rcpConnection.sendCommand(0x7e, body);
		});
		$("#load").click(function(){
			//var body = new ArrayBuffer(0);
			//rcpConnection.sendCommand(0x7e, body);
		});
		$("#store").click(function(){
			//var body = new ArrayBuffer(0);
			//rcpConnection.sendCommand(0x7f, body);
		});
		function time_string(){
			var today = new Date();
			var year = today.getYear();
			if (year < 2000)
			{
				year = year + 1900;	
			}
			var month=today.getMonth()+1;
			var date=today.getDate();
			var hour   = today.getHours();
			var minute = today.getMinutes();
			var second = today.getSeconds();
			return '('+year+'-'+month+'-'+date+' '+
						hour+':'+minute+':'+second+')';
		}
		function post_new(){
			var element = {};
			element.post_time = time_string();
			element.handlename = $("#new_handlename").val();
			element.message_body = $("#new_message_body").val();
			console.log(element);
			rcpConnection.context.
				request_splice([], [element], 0, 0);
			$("#new_message_body").val("");
		}
		$("#new_element").click(post_new);
		$("#new_handlename").focus(function(){
			rcpConnection.ping();
		});
		$("#new_message_body").focus(function(){
			rcpConnection.ping();
		});
		$("#new_message_body").keydown(function(e){
			if (e.keyCode === 13 && e.shiftKey){
				post_new();
				return false;
			}
		});
		
		//Uploader related codes
		$("#upload_button").click(function(){
			var files = $("#file_selector")[0].files;
			if (files.length != 1){
				$("#upload_result").html("Too many or no file selected.");
			}
			var file = files[0];

			function update_progress_bar(e){
				if (e.lengthComputable)	{
					$("#upload_progress")
						.attr({value:e.loaded, max:e.total});
				}
			}

			$("#upload_result").html(
				'<progress id="upload_progress"></progress>');

			$.ajax({
				url:"http://static.tuna-cat.com:5001/upload",
				type:"POST",
				data:file,
				crossDomain:true,
				cache:false,
				contentType:false,
				processData:false,
				xhr:function(){
					var xhr_object = $.ajaxSettings.xhr();
					if (xhr_object.upload){
						xhr_object.upload.addEventListener(
							'progress', update_progress_bar, false);
					}
					return xhr_object;
				},
				success:function(data, status, xhr_object){
					var uuid = data;
					var test = $("#file_selector");
					$("#file_selector")[0].value = "";
					$("#upload_result").html("uuid:"+data);
					$("#new_message_body").append("[file:"+uuid+"]");
				},
				error:function(xhr_object, text_status, error){
					$("#upload_result").html(
							"An upload failed:"+text_status);
				},
			});
		})
	});
})(jQuery)

