/**
 * hammer.js v0.01
 */

function Hammer(element, options) {
    var self = this;

    var defaults = {
        prevent_default: false, // previne (ou não) o evento padrão

        drag: true,
        drag_vertical: false,
        drag_horizontal: true,
        drag_min_distance: 20,
        drag_threshold: 90, // o quanto o sliding pode estar fora da direção exata

        transform: true, // zoom e rotação

        tap: true,
        tap_double: true,
        tap_max_interval: 300,
        tap_double_distance: 20,

        hold: true,
        hold_timeout: 500
    };

    options = $.extend({}, defaults, options);

    // certificar-se que o elemento esteja em um objeto jquery
    element = $(element);

    // alguns hacks css
    $(['-webkit-', '-moz-', '-ms-', '-o-', '']).each(function() {
        var css = {};
        var vendor = this;
        
        var props = {
            "user-select": "none",
            "touch-callout": "none",
            "user-drag": "none",
            "tap-highlight-color": "rgba(0, 0, 0, 0)"
        };

        for (var prop in props) {
            css[vendor + prop] = props[prop];
        }

        element.css(css);
    });

    // definição das direções
    this.DIRECTION = {
        UP: 360,
        DOWN: 0,
        LEFT: -180,
        RIGHT: 180
    };

    // segura a distância que foi movida
    var _distance = 0;

    // segura o ângulo exato que foi movido
    var _angle = 0;

    // segura a direção que foi movida
    var _direction = 0;

    // segura o movimento da posição para sliding
    var _pos = { };

    // quantos dedos estão na tela
    var _fingers = 0;

    var _first = false;

    var _gesture = null;
    var _prev_gesture = null;

    var _touch_start_time = null;
    var _prev_tap_pos = { x: 0, y: 0 };
    var _prev_tap_end_time = null;

    var _hold_timer = null;

    var _offset = {};

    // manter o tracking do status do mouse
    var _mousedown = false;

    /**
     * ângulo para definição de direção
     * 
     * @param float ângulo
     * 
     * @return int direção
     */
    this.getDirectionFromAngle = function(angle) {
        var dir, min, max, name;

        for (name in this.DIRECTION) {
            dir = this.DIRECTION[name];

            min = dir - options.drag_threshold;
            max = dir + options.drag_threshold;

            if (name == 'UP') {
                if (min < Math.abs(angle) && max > Math.abs(angle)) {
                    return dir;
                }
            }

            // apenas checa se está entre os ângulos
            if (min < angle && max > angle) {
                return dir;
            }
        }
    };

    /**
     * conta o número de dedos do evento.
     * quando nenhum dedo é detectado, é retornado um dedo apenas (cursor do mouse)
     * 
     * @param jQueryEvent
     * 
     * @return int dedos
     */
    function countFingers(event) {
        // há um bug no android (até a v4?) em que toques são sempre 1,
        // então multi-toques não é suportado, exemplo, zoom e rotação
        return event.originalEvent.touches ? event.originalEvent.touches.length : 1;
    }

    /**
     * obtém a posição x e y do objeto do evento
     * 
     * @param jQueryEvent
     * 
     * @return mixed objeto com o x e y ou um array com objetos
     */
    function getXYfromEvent(event) {
        var src;

        // um toque apenas
        if (countFingers(event) == 1) {
            src = event.originalEvent.touches ? event.originalEvent.touches[0] : event;

            return {
                x: src.pageX,
                y: src.pageY
            };
        }

        // multi-toque, retorna um array com as posições
        else {
            var pos = [];

            for (var t = 0; t < event.originalEvent.touches.length; t++) {
                src = event.originalEvent.touches[t];

                pos.push({
                    x: src.pageX,
                    y: src.pageY
                });
            }

            return pos;
        }
    }

    /**
     * calcula o ângulo entre dois pontos
     * 
     * @param object1 posição1 { x: int, y: int }
     * @param object2 posição2 { x: int, y: int }
     */
    function getAngle(pos1, pos2) {
        return Math.atan2(pos2.x - pos1.x, pos2.y - pos1.y) * 360 / Math.PI;
    }

    /**
     * alerta um evento/callback pelo nome com parâmetros
     * 
     * @param string nome
     * @param array parâmetros
     */
    function triggerEvent(eventName, params) {
        if ($.isFunction(self[eventName])) {
            self[eventName].apply(self, params);
        }
    }

    /**
     * reseta as variáveis internas para os valores iniciais
     */
    function reset() {
        _pos = {};
        _first = false;
        _fingers = 0;
        _distance = 0;
        _angle = 0;
        _gesture = null;
    }

    var gestures = {
        // gesto de pressionar (acionado em touchstart)
        hold: function(event) {
            // apenas quando um dedo estiver na tela
            if (options.hold && _fingers == 1) {
                _gesture = 'hold';

                clearTimeout(_hold_timer);

                _hold_timer = setTimeout(function() {
                    if (_gesture == 'hold' && _fingers == 1) {
                        triggerEvent("onHold", [event, _pos.start]);
                    }
                }, options.hold_timeout);
            }
        },

        // gesto de arrastar (acionado em mousemove)
        drag: function(event) {
            // obtém a distância que foi movida
            var _distance_x = Math.abs(_pos.move.x - _pos.start.x);
            var _distance_y = Math.abs(_pos.move.y - _pos.start.y);

            _distance = Math.max(_distance_x, _distance_y);

            // movimento mínimo necessário
            if (options.drag && (_distance > options.drag_min_distance) || _gesture == 'drag') {
                _gesture = 'drag';

                // calcula o ângulo
                _angle = getAngle(_pos.start, _pos.move);
                _direction = self.getDirectionFromAngle(_angle);

                // checa o movimento e para caso esteja indo para a direção errada
                var is_vertical = (self.DIRECTION.UP == _direction || self.DIRECTION.DOWN == _direction);

                if (((is_vertical && !options.drag_vertical) || (!is_vertical && !options.drag_horizontal)) && (_distance > options.drag_min_distance)) {
                    return;
                }

                var position = {
                    x: _pos.move.x - _offset.left,
                    y: _pos.move.y - _offset.top
                };

                // na primeira vez em que o evento for alertado
                if (_first) {
                    triggerEvent("onDragStart", [event, position, _direction, _distance, _angle]);

                    _first = false;
                }

                // evento slide normal
                triggerEvent("onDrag", [event, position, _direction, _distance, _angle]);

                event.preventDefault();
            }
        },

        // gesto de transformação (acionado em touchmove)
        transform: function(event) {
            if (options.transform) {
                _gesture = 'transform';

                var scale = event.originalEvent.scale;
                var rotation = event.originalEvent.rotation;

                if(scale || rotation) {
                    _pos.center = {
                        x: ((_pos.move[0].x + _pos.move[1].x) / 2) - _offset.left,
                        y: ((_pos.move[0].y + _pos.move[1].y) / 2) - _offset.top
                    };

                    // na primeira vez em que o evento for alertado
                    if (_first) {
                        triggerEvent("onTransformStart", [event, _pos.center, scale, rotation]);
                        
                        _first = false;
                    }

                    triggerEvent("onTransform", [event, _pos.center, scale, rotation]);

                    event.preventDefault();
                }
            }
        },

        // gesto de toque e toque duplo (acionado em touchend)
        tap: function(event) {
            // compara o tipo de gesto pelo tempo
            var now = new Date().getTime();
            var touch_time = now - _touch_start_time;

            // não aciona nada quando o hold estiver acionado
            if (options.hold && !(options.hold && options.hold_timeout > touch_time)) {
                return;
            }

            // quando o evento anterior for tocado e o toque foi um max_interval
            if (options.tap_double && _prev_gesture == 'tap' && (_touch_start_time - _prev_tap_end_time) < options.tap_max_interval) {
                if (_prev_tap_pos && _pos.start && Math.max(Math.abs(_prev_tap_pos.x - _pos.start.x), Math.abs(_prev_tap_pos.y - _pos.start.y)) < options.tap_double_distance) {
                    _gesture = 'double_tap';
                    _prev_tap_end_time = null;

                    triggerEvent("onDoubleTap", [event, _pos.start]);

                    event.preventDefault();
                }
            }

            // toque único
            else {
                _gesture = 'tap';

                _prev_tap_end_time = now;
                _prev_tap_pos = _pos.start;

                if (options.tap) {
                    triggerEvent("onTap", [event, _pos.start]);

                    event.preventDefault();
                }
            }
        }
    };

    function handleEvents(event) {
        switch (event.type) {
            case 'mousedown':
            case 'touchstart':
                _pos.start = getXYfromEvent(event);
                _touch_start_time = new Date().getTime();
                _fingers = countFingers(event);
                _first = true;
                _offset = element.offset();

                // segurar
                gestures.hold(event);

                if (options.prevent_default) {
                    event.preventDefault();
                }

                break;

            case 'mousemove':
            case 'touchmove':
                if (!_mousedown) {
                    return false;
                }

                _pos.move = getXYfromEvent(event);

                switch (_fingers) {
                    case 1:
                        gestures.drag(event);

                        break;

                    case 2:
                        gestures.transform(event);

                        break;
                }

                break;

            case 'mouseup':
            case 'touchend':
                _mousedown = false;

                // gesto de arrastar (dragstart é alertado, então dragend é possível)
                if (_gesture == 'drag' && !_first) {
                    triggerEvent("onDragEnd", [event, _direction, _distance, _angle]);
                }
                
                // gesto de transformação (transformstart é alertado, então transformend é possível)
                else if (_gesture == 'transform' && !_first) {
                    triggerEvent("onTransformEnd", [event, _pos.center, event.originalEvent.scale, event.originalEvent.rotation]);
                } else {
                    gestures.tap(event);
                }

                _prev_gesture = _gesture;

                // reseta as variáveis
                reset();

                break;
        }
    }

    if('ontouchstart' in window) {
        $(element).bind("touchstart touchmove touchend", handleEvents);
    } else {
        $(document).bind("mouseup", handleEvents);
        
        $(element).bind("mousedown mousemove", handleEvents);
    }
}