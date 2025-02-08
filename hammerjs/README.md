# hammer.js
===========

object to control the gestures on touch devices. supports the following gestures:

- tap
- double tap
- hold
- drag
- transform (escala e rotação)

tested on ipad1 with ios5, iphone4 with ios5, samsung galaxy s with android v2.3.3 and google chrome 17. requires jquery for some simple event binding and position of the container element.
on a desktop browser the mouse can be used to simulate touch events with one finger. on android 2 (and 3?) the default browser doesnt support multi-touch events, so no transform callback.

uso
---

<pre>
    // essas são as opções padrões
    var options = {
        drag: true,
        drag_vertical: false,
        drag_horizontal: true,
        drag_min_distance: 20,
        drag_threshold: 70,

        transform: true,

        tap: true,
        tap_double: true,
        tap_max_interval: 500,

        hold: true,
        hold_timeout: 500
    };

    // cria uma instância
    var hammer = new Hammer("#hitarea", options);

    // callbacks dos eventos
    hammer.onHold = function() {
        console.log('hold', arguments);
    };

    hammer.onTap = function() {
        console.log('tap', arguments);
    };

    hammer.onDoubleTap = function() {
        console.log('double tap', arguments);
    };

    hammer.onTransformStart = function() {
        console.log('transform   start', arguments);
    };

    hammer.onTransform = function() {
        console.log('transform', arguments);
    };

    hammer.onDragStart = function() {
        console.log('drag start', arguments);
    };

    hammer.onDrag = function() {
        console.log('drag', arguments);
    };

    hammer.onDragEnd = function() {
        console.log('drag end', arguments);
    };
</pre>

to do
-----

- fix the demo page and more samples with ui elements (like sliders...)
- improve event callbacks with more arguments
- device testing
- clean up the code
- better documentation

-----

criado por [cavassani]
