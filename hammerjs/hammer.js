function Hammer(element, options) {
    var self = this;

    var defaults = {
        drag: true,
        drag_vertical: false,
        drag_horizontal: true,
        drag_min_distance: 20,
        drag_space: 70,

        zoom: true,
        zoom_min: 1,
        zoom_max: 3,

        rotate: true,
        rotate_min: 0,
        rotate_max: 180,

        tap: true,
        tap_double: true,
        tap_max_interval: 500,

        hold: true,
        hold_timeout: 500,

        transform_element: $(">:first", element)
    };

    options = $.extend({}, defaults, options);

    // certificar-se que o elemento esteja em um objeto jquery
    var element = $(element);

    // alguns hacks css
    element.css({
        "-webkit-user-select": "none",
        "-webkit-touch-callout": "none",
        "-webkit-text-size-adjust": "none",
        "-webkit-tap-highlight-color": "rgba(0, 0, 0, 0)"
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
    var _prev_tap_end_time = null;

    var _hold_timer = null;

    var _offset = {};

    /**
     * ângulo para definição de direção
     * 
     * @param float ângulo
     * 
     * @return int direção
     */
    this.getDirectionFromAngle = function(angle) {
        for (var name in this.DIRECTION) {
            var min = this.DIRECTION[name] - options.slide_space;
            var max = this.DIRECTION[name] + options.slide_space;

            if (name == 'UP') {
                if (min < Math.abs(angle) && max > Math.abs(angle)) {
                    return this.DIRECTION[name];
                }
            }

            // apenas checa se está entre os ângulos
            if (min < angle && max > angle) {
                return this.DIRECTION[name];
            }
        }
    };

    /**
     * obtém a porcentagem do movimento da altura/largura do container
     * 
     * @param float distância
     * @param int direção
     * 
     * @return float porcentagem
     */
    this.distanceToPercentage = function(distance, direction) {
        var dim = self.directionIsVertical(direction) ? element.height() : element.width();

        return (100 / dim) * distance;
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

    function handleEvents(ev) {
        switch (ev.type) {
            case 'mousedown':
            case 'touchstart':
                _pos.start = getXYfromEvent(ev);
                _touch_start_time = new Date().getTime();
                _fingers = countFingers(ev);
                _first = true;
                _offset = element.offset();

                // segurar
                if (options.hold && _fingers == 1) {
                    _gesture = 'hold';

                    clearTimeout(_hold_timer);

                    _hold_timer = setTimeout(function() {
                        if (_gesture == 'hold' && _fingers == 1) {
                            triggerEvent("onHold");
                        }

                    }, options.hold_timeout);
                }

                break;

            case 'mousemove':
            case 'touchmove':
                _pos.move = getXYfromEvent(ev);

                switch (_fingers) {
                    case 1:
                        // obtém a distância que foi movida
                        _distance = Math.max(Math.abs(_pos.move.x - _pos.start.x), Math.abs(_pos.move.y - _pos.start.y));

                        // movimento mínimo necessário
                        if (options.drag && (_distance > options.drag_min_distance) || _gesture == 'drag') {
                            _gesture = 'drag';

                            // calcula o ângulo
                            _angle = getAngle(_pos.start, _pos.move);
                            _direction = self.getDirectionFromAngle(_angle);

                            // checa o movimento e para caso esteja indo para a direção errada
                            var is_vertical = (self.DIRECTION.UP == _direction || self.DIRECTION.DOWN == _direction);

                            if ((is_vertical && !options.drag_vertical) || (!is_vertical && !options.drag_horizontal)) {
                                reset();

                                return;
                            }

                            // para o evento padrão
                            ev.preventDefault();

                            var position = {
                                x: _pos.move.x - _offset.left,
                                y: _pos.move.y- _offset.top
                            };

                            // no primeiro alerta
                            if (_first) {
                                triggerEvent("onDragStart", [position, _direction, _distance, _angle]);

                                _first = false;
                            }

                            // evento de slide normal
                            triggerEvent("onDrag", [position, _direction, _distance, _angle]);
                        }

                        break;

                    // dois dedos
                    case 2:
                        _gesture = 'transform';

                        var scale = ev.originalEvent.scale;
                        var rotation = ev.originalEvent.rotation;

                        if (scale || rotation) {
                            var center = {
                                x: ((_pos.move[0].x + _pos.move[1].x) / 2) - _offset.left,
                                y: ((_pos.move[0].y + _pos.move[1].y) / 2) - _offset.top
                            };

                            // no primeiro alerta
                            if (_first) {
                                triggerEvent("onTransformStart", [center, scale, rotation]);

                                _first = false;
                            }

                            triggerEvent("onTransform", [center, scale, rotation]);
                        }

                        ev.preventDefault();

                        break;
                }

                break;

            case 'mouseup':
            case 'touchend':
                if (_gesture == 'drag') {
                    triggerEvent("onDragEnd", [_direction, _distance, _angle]);
                } else {
                    // compara o tipo de gesto pelo tempo
                    var now = new Date().getTime();
                    var touch_time = now - _touch_start_time;

                    // não dispara quando o hold estiver disparado
                    if (!options.hold || (options.hold && options.hold_timeout > touch_time)) {
                        // quando o evento anterior for disparado
                        if (options.tap_double && _prev_gesture == 'tap' && (_touch_start_time - _prev_tap_end_time) < options.tap_max_interval) {
                            _gesture = 'double_tap';

                            _prev_tap_end_time = null;

                            triggerEvent("onDoubleTap");

                            ev.preventDefault();
                        }

                        // toque único
                        else if (options.tap) {
                            _gesture = 'tap';

                            _prev_tap_end_time = now;

                            triggerEvent("onTap");

                            ev.preventDefault();
                        }
                    }
                }

                _prev_gesture = _gesture;

                // reseta as variáveis
                reset();

                break;
        }
    }

    $(element).bind("touchstart touchmove touchend", handleEvents);
}