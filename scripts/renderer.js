import * as CG from './transforms.js';
import { Matrix } from './matrix.js';

class Renderer {
    // canvas:              object ({id: __, width: __, height: __})
    // limit_fps_flag:      bool 
    // fps:                 int
    constructor(canvas, limit_fps_flag, fps) {
        this.canvas = document.getElementById(canvas.id);
        this.canvas.width = canvas.width;
        this.canvas.height = canvas.height;
        this.ctx = this.canvas.getContext('2d');
        this.slide_idx = 0;
        this.limit_fps = limit_fps_flag;
        this.fps = fps;
        this.start_time = null;
        this.prev_time = null;

        this.models = {
            slide0: [
                // Bouncing ball: circle (polygon with 32 sides) centered at the origin
                {
                    vertices: this.circleVertices(40, 32),
                    position: {x: 400, y: 300},      // center of the ball (pixels)
                    velocity: {x: 250, y: 180},      // pixels per second
                    radius: 40,
                    transform: new Matrix(3, 3)
                }
            ],
            slide1: [],
            slide2: [],
            slide3: [
                // Sun: pulses (grows / shrinks) in the center of the canvas
                {
                    vertices: this.circleVertices(60, 32),
                    transform: new Matrix(3, 3)
                },
                // Planet: square that spins about its own center AND orbits the sun
                {
                    vertices: [
                        CG.Vector3(-20, -20, 1),
                        CG.Vector3( 20, -20, 1),
                        CG.Vector3( 20,  20, 1),
                        CG.Vector3(-20,  20, 1)
                    ],
                    transform: new Matrix(3, 3)
                },
                // Moon: small hexagon that orbits the planet
                {
                    vertices: this.circleVertices(10, 6),
                    transform: new Matrix(3, 3)
                }
            ]
        };
    }

    // Vertices of a regular polygon centered at the origin (0, 0)
    // (enough sides makes it look like a circle)
    // radius:     number
    // num_sides:  int
    circleVertices(radius, num_sides) {
        let vertices = [];
        for (let i = 0; i < num_sides; i++) {
            let phi = (2 * Math.PI * i) / num_sides;
            vertices.push(CG.Vector3(radius * Math.cos(phi), radius * Math.sin(phi), 1));
        }
        return vertices;
    }

    // flag:  bool
    limitFps(flag) {
        this.limit_fps = flag;
    }

    // n:  int
    setFps(n) {
        this.fps = n;
    }

    // idx: int
    setSlideIndex(idx) {
        this.slide_idx = idx;
    }

    animate(timestamp) {
        // Get time and delta time for animation
        if (this.start_time === null) {
            this.start_time = timestamp;
            this.prev_time = timestamp;
        }
        let time = timestamp - this.start_time;
        let delta_time = timestamp - this.prev_time;
        //console.log('animate(): t = ' + time.toFixed(1) + ', dt = ' + delta_time.toFixed(1));

        // Update transforms for animation
        this.updateTransforms(time, delta_time);

        // Draw slide
        this.drawSlide();

        // Invoke call for next frame in animation
        if (this.limit_fps) {
            setTimeout(() => {
                window.requestAnimationFrame((ts) => {
                    this.animate(ts);
                });
            }, Math.floor(1000.0 / this.fps));
        }
        else {
            window.requestAnimationFrame((ts) => {
                this.animate(ts);
            });
        }

        // Update previous time to current one for next calculation of delta time
        this.prev_time = timestamp;
    }

    //
    updateTransforms(time, delta_time) {
        // TODO: update any transformations needed for animation
        // time and delta_time are in milliseconds -> convert to seconds
        let t = time / 1000.0;
        let dt = delta_time / 1000.0;

        // ---------- Slide 0: bouncing ball ----------
        // Time since last frame:  position = position + velocity * dt
        let ball = this.models.slide0[0];
        ball.position.x += ball.velocity.x * dt;
        ball.position.y += ball.velocity.y * dt;

        // Hit left / right edge -> reverse x velocity
        // (and bounce back the distance it went past the edge, so the motion
        //  is the same no matter the frame rate)
        let left = ball.radius;
        let right = this.canvas.width - ball.radius;
        if (ball.position.x < left) {
            ball.position.x = left + (left - ball.position.x);
            ball.velocity.x = -ball.velocity.x;
        }
        else if (ball.position.x > right) {
            ball.position.x = right - (ball.position.x - right);
            ball.velocity.x = -ball.velocity.x;
        }
        // Hit bottom / top edge -> reverse y velocity
        let bottom = ball.radius;
        let top = this.canvas.height - ball.radius;
        if (ball.position.y < bottom) {
            ball.position.y = bottom + (bottom - ball.position.y);
            ball.velocity.y = -ball.velocity.y;
        }
        else if (ball.position.y > top) {
            ball.position.y = top - (ball.position.y - top);
            ball.velocity.y = -ball.velocity.y;
        }
        // Ball's vertices are centered at the origin, so just translate to its position
        CG.mat3x3Translate(ball.transform, ball.position.x, ball.position.y);
        

        // ---------- Slide 3: sun, planet, and moon ----------
        // Time since start:  angle = angular velocity * t
        let center = {x: this.canvas.width / 2, y: this.canvas.height / 2};
        let translate_center = new Matrix(3, 3);
        CG.mat3x3Translate(translate_center, center.x, center.y);

        // Sun: grows and shrinks between 0.8x and 1.2x size, once per second
        let sun_scale = 1.0 + 0.2 * Math.sin(2 * Math.PI * t);
        let scale_sun = new Matrix(3, 3);
        CG.mat3x3Scale(scale_sun, sun_scale, sun_scale);
        this.models.slide3[0].transform = Matrix.multiply([translate_center, scale_sun]);
        
        // Planet: orbits the sun once every 6 seconds (counter-clockwise)
        // and spins about its own center once per second (clockwise)
        let orbit_angle = (2 * Math.PI / 6) * t;
        let spin_angle = -(2 * Math.PI) * t;
        let rotate_orbit = new Matrix(3, 3);
        CG.mat3x3Rotate(rotate_orbit, orbit_angle);
        let translate_orbit = new Matrix(3, 3);
        CG.mat3x3Translate(translate_orbit, 200, 0);          // orbit radius = 200 px
        let rotate_spin = new Matrix(3, 3);
        CG.mat3x3Rotate(rotate_spin, spin_angle);
        // Read right to left: spin -> move out to orbit radius -> rotate around sun -> move to center
        let planet_position = Matrix.multiply([translate_center, rotate_orbit, translate_orbit]);
        this.models.slide3[1].transform = Matrix.multiply([planet_position, rotate_spin]);
        
        // Moon: orbits the planet twice per second
        let moon_angle = (2 * Math.PI * 2) * t;
        let rotate_moon = new Matrix(3, 3);
        CG.mat3x3Rotate(rotate_moon, moon_angle);
        let translate_moon = new Matrix(3, 3);
        CG.mat3x3Translate(translate_moon, 50, 0);            // distance from planet = 50 px
        this.models.slide3[2].transform = Matrix.multiply([planet_position, rotate_moon, translate_moon]);
        
    }
    
    //
    drawSlide() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        switch (this.slide_idx) {
            case 0:
                this.drawSlide0();
                break;
            case 1:
                this.drawSlide1();
                break;
            case 2:
                this.drawSlide2();
                break;
            case 3:
                this.drawSlide3();
                break;
        }
    }

    //
    drawSlide0() {
        // TODO: draw bouncing ball (circle that changes direction whenever it hits an edge)
        let red = [255, 0, 0, 255];
        this.drawModel(this.models.slide0[0], red);
    }

    //
    drawSlide1() {
        // TODO: draw at least 3 polygons that spin about their own centers
        //   - have each polygon spin at a different speed / direction
        
        
    }

    //
    drawSlide2() {
        // TODO: draw at least 2 polygons grow and shrink about their own centers
        //   - have each polygon grow / shrink different sizes
        //   - try at least 1 polygon that grows / shrinks non-uniformly in the x and y directions


    }

    //
    drawSlide3() {
        // TODO: get creative!
        //   - animation should involve all three basic transformation types
        //     (translation, scaling, and rotation)
        let yellow = [255, 200,   0, 255];
        let blue   = [ 30, 100, 220, 255];
        let gray   = [140, 140, 140, 255];
        this.drawModel(this.models.slide3[0], yellow);   // sun
        this.drawModel(this.models.slide3[1], blue);     // planet
        this.drawModel(this.models.slide3[2], gray);     // moon      
    }
    
    // Multiply each vertex by the model's transform, then draw the result
    // model:  object {vertices: [...], transform: Matrix(3, 3)}
    // color:  array of int [R, G, B, A]
    drawModel(model, color) {
        let transformed = [];
        for (let i = 0; i < model.vertices.length; i++) {
            transformed.push(Matrix.multiply([model.transform, model.vertices[i]]));
        }
        this.drawConvexPolygon(transformed, color);
    }

    // vertex_list:  array of object [Matrix(3, 1), Matrix(3, 1), ..., Matrix(3, 1)]
    // color:        array of int [R, G, B, A]
    drawConvexPolygon(vertex_list, color) {
        this.ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + (color[3] / 255) + ')';
        this.ctx.beginPath();
        let x = vertex_list[0].values[0][0] / vertex_list[0].values[2][0];
        let y = vertex_list[0].values[1][0] / vertex_list[0].values[2][0];
        this.ctx.moveTo(x, y);
        for (let i = 1; i < vertex_list.length; i++) {
            x = vertex_list[i].values[0][0] / vertex_list[i].values[2][0];
            y = vertex_list[i].values[1][0] / vertex_list[i].values[2][0];
            this.ctx.lineTo(x, y);
        }
        this.ctx.closePath();
        this.ctx.fill();
    }
};

export { Renderer };
