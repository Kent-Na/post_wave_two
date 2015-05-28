//Script for index html
//by Kent-Na

(function($){
	$(document).ready(function(){
		var url = "ws://rcp.tuna-cat.com/rcp"
		$("#server_url").text(url);

		var rcpConnection = rcpJS.rcpConnection();
		rcpConnection.onopen = function(){
			$("#server_status").text("online");
			rcpConnection.sendOpen();
		}
		rcpConnection.onerror= function(){
			$("#server_status").text("offline(error)");
		}
		rcpConnection.onclose= function(e){
			$("#server_status").text(
				"closed by server(" + e.code + ")");
		}

		rcpConnection.connectToURL(url);

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
					.attr("class", "element_box");
				element.dom_element = box[0];
			}
			function setup_as_editor(){
				var box = $("#edit_element_box_template")
					.clone()
					.appendTo("#list_container")
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
					.text(json_element.message_body);
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

			element.to_editor = function(){
				var old_dom = element.dom_element;
				setup_as_editor();
				sync_as_editor();

				var new_dom = element.dom_element;
				$(old_dom).replaceWith($(new_dom));
			}
			element.to_view = function(){
				var old_dom = element.dom_element;
				setup_as_view();
				sync_as_view();

				var new_dom = element.dom_element;
				$(old_dom).replaceWith($(new_dom));
			}

			return element;
		}

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
				var index = command.path[0];
				list_elements[index].sync(index);
			}
		}

		$("#reset").click(function(){
			rcpConnection.context.
				request_set([], []);
		});
		$("#load").click(function(){
			var body = new ArrayBuffer(0);
			rcpConnection.sendCommand(0x7e, body);
		});
		$("#store").click(function(){
			var body = new ArrayBuffer(0);
			rcpConnection.sendCommand(0x7f, body);
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
			$("#new_handlename").val("");
			$("#new_message_body").val("");
		}
		$("#new_element").click(post_new);
		$("#new_message_body").keydown(function(e){
			if (e.keyCode === 13 && e.shiftKey){
				post_new();
			}
		});


	});
})(jQuery)

