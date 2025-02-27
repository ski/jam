'use strict';

/*

      popup.prompt( options={ content: 'x', placeholder:'y'}, function (result) {
        console.log(result.proceed,result.input_value)
      });

      New: Multi-input forms!
      
      popup.prompt( { content: ['Columns','Rows','Variables'], placeholder:[2,2,'a,b']}, function (result) {
        console.log(result.proceed,result.input_value)
      });

      popup.confirm( { content : string },  function (result) {
        console.log(result.proceed,result.input_value)
      })
      
      New: The options object gets a close attribute assigned that can be called externally to close the popup.
      
      Version 1.2.3

*/
function _typeof(obj) {
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}

var popup;

(function() {
    var modal_created = 0,
        modal_hidden = 0,
        cb_arr = [],
        config_arr = [];

    var keyboard = true,
        backdrop_close = true,
        backdrop_less = true,
        btn_align = 'left',
        modal_size = 'small',
        bg_overlay_color = '#000',
        modal_effect = 'top';

    var curr_modal = undefined;
    var curr_backdrop = 'modal_backdrop';
    var modal_btns = {};

    var addRemoveModal = function addRemoveModal(config) {
        if (config == true) {
            ++modal_created;
        } else {
            --modal_created;
        }

        curr_modal = 'popup_modal_' + modal_created;
    };

    var createModal = function createModal() {
        addRemoveModal(true);

        var new_modal = document.createElement('div');
        new_modal.id = 'popup_modal_' + modal_created;
        new_modal.className = 'popup_modals fade ' + config_arr[config_arr.length - 1].modal_effect;

        var size = config_arr[config_arr.length - 1].modal_size;
        if (typeof size === 'string') {
            new_modal.className += ' modal_' + config_arr[config_arr.length - 1].modal_size;
        } else if (typeof size === 'number') {
            new_modal.style.width = size + 'px';
        }

        var modal_content = document.createElement('div');
        modal_content.className = 'modal_content';

        var modal_buttons = document.createElement('div');
        modal_buttons.className = 'modal_buttons ' + config_arr[config_arr.length - 1].btn_align;

        new_modal.appendChild(modal_content);
        new_modal.appendChild(modal_buttons);

        document.body.appendChild(new_modal);
    };

    var hasClass = function hasClass(target, className) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;
        var iterator = (typeof Symbol == 'undefined'?'iterator':Symbol.iterator);
        try {
            for (var _iterator = target[iterator](), 
                     _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var this_class = _step.value;

                if (this_class == className) {
                    return true;
                }
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                    _iterator.return();
                }
            } finally {
                if (_didIteratorError) {
                    // Fallback solution
                    for(var i=0;i<target.length;i++) 
                      if (target[i]==className) return true;
                    return false; // throw _iteratorError;
                }
            }
        }

        return false;
    };

    var addClass = function addClass(target, className) {
        target.className += ' ' + className;
    };

    var removeClass = function removeClass(target, className) {
        var regex = new RegExp('(?:^|\\s)' + className + '(?!\\S)', 'g');
        target.className = target.className.replace(regex, '');
    };

    var loadCallback = function loadCallback(e) {
        var callback = cb_arr[cb_arr.length - 1],
            cb_obj = {
                e: e,
                proceed: false
            };

        if (e.type == 'click') {
            if (hasClass(e.currentTarget.classList, 'btn_pmry')) {
                cb_obj.proceed = true;
                console.log('Click proceed : true');
            } else {
                console.log('Click proceed : false');
            }
        } else if (e.type == 'keydown') {
            if (e.keyCode == 13) {
                cb_obj.proceed = true;
                console.log('Keydown proceed : true');
            } else {
                console.log('Keydown proceed : false');
            }
        }

        if (!modal_hidden && callback) {
            var input_doms = document.getElementById(curr_modal).getElementsByClassName('modal_input');

            if (input_doms && input_doms.length==1)
              cb_obj.input_value = input_doms[0].value;
            else if (input_doms && input_doms.length>1) {
              cb_obj.input_value = [];
              for(var i=0;i<input_doms.length;i++) cb_obj.input_value.push(input_doms[i].value||input_doms[i].placeholder||'');
            } else 
              cb_obj.input_value = null;

            setTimeout(function() {
                callback(cb_obj);
            }, 350);
        }

        hideModal();
    };

    var loadButtons = function loadButtons(popup_type) {

        for (var keys in modal_btns) {
            if (popup_type == 'alert' && Object.keys(modal_btns).indexOf(keys) == 1) {
                continue;
            }

            var this_btn = modal_btns[keys];
            var this_btn_id = undefined;

            var btn_dom = document.createElement('a');
            btn_dom.id = this_btn_id = this_btn.btn_id + '_' + modal_created;
            btn_dom.className = this_btn.btn_class;
            btn_dom.innerHTML = this_btn.inner_text;

            document.getElementById(curr_modal).getElementsByClassName('modal_buttons')[0].appendChild(btn_dom);

            document.getElementById(this_btn_id).addEventListener('click', function(e) {
                loadCallback(e);
            });
        }
    };

    var keydownEvent = function keydownEvent(e) {
        if (e.keyCode == 13 || e.keyCode == 27) {
            loadCallback(e);
        }
    };

    var backdropClose = function backdropClose(e) {
        loadCallback(e);
    };

    var enableBackdropClose = function enableBackdropClose() {
        document.getElementById('modal_backdrop').removeEventListener('click', backdropClose);

        if (config_arr[config_arr.length - 1].backdrop_close) {
            document.getElementById(curr_backdrop).addEventListener('click', backdropClose);
        }
    };

    var attachKeyboardEvent = function attachKeyboardEvent() {
        document.removeEventListener('keydown', keydownEvent);

        if (config_arr[config_arr.length - 1].keyboard) {
            document.addEventListener('keydown', keydownEvent);
        }
    };

    var showModal = function showModal() {
        modal_hidden = 0;
        if (!backdrop_less) {
          var backdrop_dom = document.createElement('div');
          backdrop_dom.id = curr_backdrop;
          backdrop_dom.className = 'modal_backdrop fade';
        }  
        document.getElementById(curr_modal).style.zIndex = 5 + modal_created * 10;

        if (modal_created < 2) {
            if (!backdrop_less) document.body.appendChild(backdrop_dom);
        } else {
            for (var i = modal_created - 1; i > 0; i--) {
                document.getElementById('popup_modal_' + i).style.transform = 'translate(-' + (modal_created - i) * 20 + 'px, -' + (modal_created - i) * 20 + 'px)';
            }

            if (!backdrop_less) document.getElementById(curr_backdrop).style.zIndex = modal_created * 10;

            console.log('popup_modal_' + (modal_created - 1) + ' : hidden');
        }

        if (!backdrop_less) document.getElementById(curr_backdrop).style.background = config_arr[config_arr.length - 1].bg_overlay_color;

        setTimeout(function() {
            if (modal_created < 2) {
                if (!backdrop_less) addClass(document.getElementById(curr_backdrop), 'in');
            }

            setTimeout(function() {
                addClass(document.getElementById(curr_modal), 'in');
                console.log(curr_modal + ' : shown');

                var input_dom = document.getElementById(curr_modal).getElementsByClassName('modal_input')[0];
                if (input_dom) {
                    input_dom.focus();
                }

                if (!backdrop_less) enableBackdropClose();
                attachKeyboardEvent();
            }, 15);
        }, 15);
    };

    var hideModal = function hideModal() {
        if (modal_hidden) return;
        modal_hidden = 1;
        document.removeEventListener('keydown', keydownEvent);
        if (!backdrop_less) document.getElementById('modal_backdrop').removeEventListener('click', backdropClose);

        removeClass(document.getElementById(curr_modal), 'in');
        console.log(curr_modal + ' : hidden',modal_hidden);

        setTimeout(function() {
            if (modal_created < 2) {
                if (!backdrop_less) removeClass(document.getElementById(curr_backdrop), 'in');
            }

            setTimeout(function() {
                if (modal_created == 0) return;
                document.body.removeChild(document.getElementById(curr_modal));

                addRemoveModal(false);

                config_arr.pop();
                cb_arr.pop();

                if (modal_created < 1) {
                    if (!backdrop_less) document.body.removeChild(document.getElementById(curr_backdrop));
                } else {
                    if (!!backdrop_less) {
                      document.getElementById(curr_backdrop).style.background = config_arr[config_arr.length - 1].bg_overlay_color;
                      document.getElementById(curr_backdrop).style.zIndex = modal_created * 10;
                    }
                    for (var i = modal_created; i > 0; i--) {
                        document.getElementById('popup_modal_' + i).style.transform = 'translate(-' + (modal_created - i) * 20 + 'px, -' + (modal_created - i) * 20 + 'px)';

                        if (i == modal_created) {
                            if (document.getElementById(curr_modal).style.removeProperty) {
                                document.getElementById(curr_modal).style.removeProperty('transform');
                            } else {
                                document.getElementById(curr_modal).style.removeAttribute('transform');
                            }
                        }
                    }

                    console.log('popup_modal_' + modal_created + ' : shown');

                    var input_dom = document.getElementById('popup_modal_' + modal_created).getElementsByClassName('modal_input')[0];
                    if (input_dom) {
                        input_dom.focus();
                    }

                    if (!backdrop_less) enableBackdropClose();
                    attachKeyboardEvent();
                }
            }, 15);
        }, 15);
    };

    var modal = function modal(type, options, callback) {
        var input_len = 500,
            default_value,
            placeholder = "",
            content_dom,
            user_ok = undefined,
            user_cancel = undefined,
            content,
            i=0,
            config = {},
            content_doms = [],
            content_label,
            done=false;
       if (options && options.label) {
         content_label = document.createElement('div');
         content_label.innerHTML='<h3>'+options.label+'</h3>';
         content_label.style['margin-bottom']='5px';
       }
       while (!done && (++i)<100) {
         try {
              default_value=null;
              content_dom = document.createElement('div');
              content_dom.className='popup_label';
              if (options && (typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object') {

                  if (options.content) {
                      if (Utils.isArray(options.content)) {
                        content=options.content.shift();
                      } else { 
                        content=options.content; 
                        options.content=null;
                      };
                      content_dom.innerHTML = content;
                      if (!options.content || options.content.length==0) done=true;
                  } else {
                      throw 'content not specified';
                  }
                  
                  if (options.placeholder) {
                      if (Utils.isArray(options.placeholder)) {
                          placeholder = options.placeholder.shift();
                      } else if (typeof options.placeholder === 'string') {
                          placeholder = options.placeholder;
                      } else {
                          throw 'placeholder is not type string';
                      }
                  }

                  if (options.default) {
                      if (Utils.isArray(options.default)) {
                          default_value = options.default.shift();
                      } else if (typeof options.default === 'string') {
                          default_value = options.default;
                      } else {
                          throw 'default is not type string';
                      }
                  }

                  if (options.input_length) {
                      if (typeof options.input_length === 'number') {
                          input_len = options.input_length;
                      } else {
                          throw 'input_length is not type number';
                      }
                  }

                 if (done) {
                    if (options.keyboard !== undefined) {
                        if (typeof options.keyboard === 'boolean') {
                            config.keyboard = options.keyboard;
                        } else {
                            throw 'keyboard is not type boolean';
                        }
                    } else {
                        config.keyboard = keyboard;
                    }

                    if (options.backdrop_close !== undefined) {
                        if (typeof options.backdrop_close === 'boolean') {
                            config.backdrop_close = options.backdrop_close;
                        } else {
                            throw 'backdrop_close is not type boolean';
                        }
                    } else {
                        config.backdrop_close = backdrop_close;
                    }
                    if (options.default_btns) {
                        if (_typeof(options.default_btns) === 'object') {
                            var _options$default_btns = options.default_btns;
                            user_ok = _options$default_btns.ok;
                            user_cancel = _options$default_btns.cancel;
                        } else {
                            throw 'default_btns is not type object';
                        }
                    }

                    modal_btns = {
                        ok: {
                            btn_id: 'btn_ok',
                            btn_class: 'btn btn_pmry',
                            inner_text: user_ok || 'Ok'
                        },
                        cancel: {
                            btn_id: 'btn_cancel',
                            btn_class: 'btn btn_sdry',
                            inner_text: user_cancel || 'Cancel'
                        }
                    };

                    if (options.custom_btns) {
                        if (_typeof(options.custom_btns) === 'object') {
                            var ext_count = 0;

                            for (var attr in options.custom_btns) {
                                modal_btns[attr] = {
                                    btn_id: 'btn_extra_' + ++ext_count,
                                    btn_class: 'btn btn_extra',
                                    inner_text: options.custom_btns[attr]
                                };
                            }
                        } else {
                            throw 'custom_btns is not type object';
                        }
                    }

                    if (options.btn_align) {
                        if (!(options.btn_align === 'left' || options.btn_align === 'right')) {
                            throw 'btn_align is not type string and only accepts value of "left" or "right"';
                        }
                    }
                    config.btn_align = options.btn_align || btn_align;
                  }
                   


                  if (options.modal_size) {
                      if (!(typeof options.modal_size === 'number' || options.modal_size === 'large' || options.modal_size === 'medium' || options.modal_size === 'small')) {
                          throw 'modal_size is not type number / string and only accepts value of "small", "medium" or "large"';
                      }
                  }
                  config.modal_size = options.modal_size || modal_size;

                  if (options.bg_overlay_color) {
                      if (typeof options.bg_overlay_color !== 'string') {
                          throw 'bg_overlay_color is not type string';
                      }
                  }
                  config.bg_overlay_color = options.bg_overlay_color || bg_overlay_color;

                  if (options.effect) {
                      if (!(options.effect === 'top' || options.effect === 'bottom' || options.effect === 'right' || options.effect === 'left' || options.effect === 'none')) {
                          throw 'effect is not type string and onlty accepts value of "top", "bottom", "right", "left" or "none"';
                      }
                  }
                  config.modal_effect = options.effect || modal_effect;
              } else {
                  throw 'No content specified.';
              }
          } catch (err) {
              console.warn(err + '. Rollback.');
              return;
          }

          content_doms.push(content_dom);

          if (type == 'prompt') {
              var modal_input = document.createElement('input');
              modal_input.type = 'text';
              modal_input.className = 'modal_input';
              modal_input.placeholder = placeholder;
              modal_input.maxLength = input_len;
              modal_input.style.width = '100%';
              if (default_value) modal_input.value=default_value;

              content_doms.push(modal_input);
          }
        }
        config_arr.push(config);

        if (callback) {
            cb_arr.push(callback);
        } else {
            cb_arr.push(null);
        }

        createModal();

        if (content_label) 
          document.getElementById(curr_modal).getElementsByClassName('modal_content')[0].appendChild(content_label);
        var form_wrapper = document.createElement('div');
        form_wrapper.className='popup_form';
        document.getElementById(curr_modal).getElementsByClassName('modal_content')[0].appendChild(form_wrapper);
        content_doms.forEach(function (dom) {
          form_wrapper.appendChild(dom);
        })

        loadButtons(type);
        options.close = function () { hideModal() }; // external close request
        showModal();
        /* jquery-ui breaks panel! draggable disables
        $('.modal_buttons').attr('draggable','true');
        $('#'+curr_modal).draggable({cancel: '.scrollable'});
        $('.modal_content').addClass('scrollable');
        */    

    };

    var alert = function alert(options, callback) {
        modal('alert', options, callback);
    };

    var confirm = function confirm(options, callback) {
        modal('confirm', options, callback);
    };

    var prompt = function prompt(options, callback) {
        modal('prompt', options, callback);
    };

    var custom = function prompt(options, callback) {
        modal('custom', options, callback);
    };
    
    popup = {
        alert: alert,
        prompt: prompt,
        confirm: confirm,
        custom: custom
    };
    
})();
