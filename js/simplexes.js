var RADIUS = 10;
var LINEWIDTH = RADIUS/4;
var GRAY = '#D3D3D3';
var REC_LIM = 4;
var INT_TEX = "\\int_X h\\ \\operatorname{d}\\chi = "

$(function() {
    var QUEUE = MathJax.Hub.queue;  // shorthand for the queue
    var math = null;                // the element jax for the math output.
    QUEUE.Push(function () {
      math = MathJax.Hub.getAllJax("integral")[0];
    });    

    var intVal = 0;
    var canvas = document.getElementById('canvas');
    var two = new Two({
        width: $(canvas).width(),
        height: $(window).height(),
    }).appendTo(canvas);
    var $canvas = $("svg"),
        $fVal = $("#f-val");
    $canvas.mousedown(function(e) {
        e.preventDefault();
        addVertex(e);
    });
    $(document).keypress(function(e) { if(e.which == 13) endStage(); });
    $canvas.contextmenu(function(e) { e.preventDefault() });
    var offset  = $canvas.offset();
    var mouse = new Two.Anchor();

    var stage = 1;
    var auxTris = two.makeGroup(),
        tris = two.makeGroup(),
        auxEdges = two.makeGroup(),
        edges = two.makeGroup(),
        rects = two.makeGroup(),
        verts = two.makeGroup();
    var adj = {};

    var maxF = -Infinity;
    
    $fVal.focus();
    
    function addVertex(e) {
        mouse.x = e.clientX - offset.left;
        mouse.y = e.clientY - offset.top;

        var fVal = parseInt($fVal.val());
        if (Number.isInteger(fVal)) {
            var vert = two.makeCircle(mouse.x, mouse.y, RADIUS);
            vert.fVal = fVal;
            vert.dim = 0;
            vert.placed = true;
            verts.add(vert);
            recolor(fVal);
        }

        $fVal.val(maxF).select();
        two.update();
    }

    function bindInt(simp) {
        setBW(simp);
        if (simp.dim == 1) { elem = $(simp.rect._renderer.elem); console.log('hey'); }
        else elem = $(simp._renderer.elem);
        elem.bind('mouseover.int', function(e) {
            if (simp.inInt) setBW(simp);
            else setColor(simp);
        });
        elem.bind('mouseout.int', function(e) {
            if (simp.inInt) setColor(simp);
            else setBW(simp);
        });
        elem.bind('mousedown.int', function(e) {
            var simpVal;
            if (simp.inInt) {
                simpVal = -simp.fVal;
                if (simp.dim == 1) simpVal *= -1;
                simp.inInt = false;
                setBW(simp);
            }
            else {
                simpVal = simp.fVal;
                if (simp.dim == 1) simpVal *= -1;
                simp.inInt = true;
                setColor(simp);
            }
            intVal += simpVal;

            QUEUE.Push(["Text",math,INT_TEX+intVal]);
            two.update();
        });
    }

    function unbindInt(simp) {
        setColor(simp);
        intVal = 0;
        $("#eul").html(0);
        simp.inInt = false;
        if (simp.dim == 1) elem = $(simp.rect._renderer.elem);
        else elem = $(simp._renderer.elem);
        elem.unbind(".int");
    }

    function recolor(fVal) {
        maxF = Math.max(Math.abs(fVal), maxF);

        $.each($.merge($.merge($.merge([], verts.children), edges.children), tris.children), function (i, simp) {
            if (simp.placed) {
                if (stage == 4)
                    setBW(simp);
                else
                    setColor(simp);
            }
        });
    }

    function setBW(simp) {
        if (simp.fVal > 0) {
            var gb = 255 - Math.round(255 * simp.fVal / maxF);
            simp.stroke = simp.fill = 'rgb(' + gb + ', ' + gb + ', ' + gb + ')';
        }
        else {
            var rg = 255 - Math.round(255 * simp.fVal / (-maxF));
            simp.stroke = simp.fill = 'rgb(' + rg + ', ' + rg + ', ' + rg + ')';
        }
        two.update();
    }

    function setColor(simp) {
        if (simp.fVal > 0) {
            var gb = 255 - Math.round(255 * simp.fVal / maxF);
            simp.stroke = simp.fill = 'rgb(255, ' + gb + ', ' + gb + ')';
        }
        else {
            var rg = 255 - Math.round(255 * simp.fVal / (-maxF));
            simp.stroke = simp.fill = 'rgb(' + rg + ', ' + rg + ', 255)';
        }
        two.update();
    }

    function extendEdge(edge) {
        edge.opacity = 0;
        subdivEdge(edge, 1, edge)

        two.update();

        $(edge.rect._renderer.elem).unbind('mouseover').bind('mousemove', function(e) {
            e.preventDefault();

            mouse.x = e.clientX - offset.left;
            mouse.y = e.clientY - offset.top;
            $fVal.val(calcEF(edge, mouse.x, mouse.y));
        });
    }

    function subdivEdge(edge, i, realEdge) {
        var a = new Two.Anchor(edge.vertices[0].x + edge.translation.x, edge.vertices[0].y + edge.translation.y);
        var b = new Two.Anchor(edge.vertices[1].x + edge.translation.x, edge.vertices[1].y + edge.translation.y);

        var c = new Two.Anchor((a.x+b.x)/2, (a.y+b.y)/2);

        var e1 = two.makeLine(a.x, a.y, c.x, c.y);
        e1.linewidth = LINEWIDTH;
        var e2 = two.makeLine(c.x, c.y, b.x, b.y);
        e2.linewidth = LINEWIDTH;

        auxEdges.add(e1, e2);
        auxEdges.remove(edge);

        if (i == REC_LIM) {
            e1.fVal = calcEF(realEdge, e1.translation.x, e1.translation.y);
            setColor(e1);
            e2.fVal = calcEF(realEdge, e2.translation.x, e2.translation.y);
            setColor(e2);
        }

        two.update();

        if (i < REC_LIM) {
            subdivEdge(e1, i+1, realEdge);
            subdivEdge(e2, i+1, realEdge);
        }
    }

    function calcEF(edge, x, y) {
        var trans = edge.translation;
        var a = edge.rect.vertices[0];
        var b = edge.rect.vertices[1];
        var c = edge.rect.vertices[2];
        var d = edge.rect.vertices[3];

        var d1 = pDistance(x, y, a.x + trans.x, a.y + trans.y, b.x + trans.x, b.y + trans.y);
        var d2 = pDistance(x, y, c.x + trans.x, c.y + trans.y, d.x + trans.x, d.y + trans.y);

        var l1 = d1 / (d1+d2);
        var l2 = d2 / (d1+d2);

        return (l2*verts.children[edge.faces[0]].fVal + l1*verts.children[edge.faces[1]].fVal).toFixed(2);
    }

    function extendTri(tri) {
        tri.opacity = 0;
        subdivTri(tri, 1, tri);

        two.update();

        $(tri._renderer.elem).unbind('mouseover').bind('mousemove', function(e) {
            e.preventDefault();

            mouse.x = e.clientX - offset.left;
            mouse.y = e.clientY - offset.top;
            $fVal.val(calcTF(tri, mouse.x, mouse.y));
        });
    }

    function subdivTri(tri, i, realTri) {
        var a = new Two.Anchor(tri.vertices[0].x + tri.translation.x, tri.vertices[0].y + tri.translation.y);
        var b = new Two.Anchor(tri.vertices[1].x + tri.translation.x, tri.vertices[1].y + tri.translation.y);
        var c = new Two.Anchor(tri.vertices[2].x + tri.translation.x, tri.vertices[2].y + tri.translation.y);

        var d = new Two.Anchor((a.x+b.x)/2, (a.y+b.y)/2);
        var e = new Two.Anchor((b.x+c.x)/2, (b.y+c.y)/2);
        var f = new Two.Anchor((a.x+c.x)/2, (a.y+c.y)/2);

        var t1 = two.makePath(a.x, a.y, d.x, d.y, f.x, f.y);
        var t2 = two.makePath(d.x, d.y, e.x, e.y, f.x, f.y);
        var t3 = two.makePath(f.x, f.y, e.x, e.y, c.x, c.y);
        var t4 = two.makePath(d.x, d.y, b.x, b.y, e.x, e.y);

        auxTris.add(t1, t2, t3, t4);
        auxTris.remove(tri)

        if (i == REC_LIM) {
            t1.fVal = calcTF(realTri, t1.translation.x, t1.translation.y);
            setColor(t1);
            t2.fVal = calcTF(realTri, t2.translation.x, t2.translation.y);
            setColor(t2);
            t3.fVal = calcTF(realTri, t3.translation.x, t3.translation.y);
            setColor(t3);
            t4.fVal = calcTF(realTri, t4.translation.x, t4.translation.y);
            setColor(t4);
        }

        two.update();

        if (i < REC_LIM) {
            subdivTri(t1, i+1, realTri);
            subdivTri(t2, i+1, realTri);
            subdivTri(t3, i+1, realTri);
            subdivTri(t4, i+1, realTri);
        }
    }

    function calcTF(tri, x, y) {
        var a = verts.children[tri.zeroFaces[0]];
        var b = verts.children[tri.zeroFaces[1]];
        var c = verts.children[tri.zeroFaces[2]];
        
        var x1 = a.translation.x;
        var y1 = a.translation.y;
        var x2 = b.translation.x;
        var y2 = b.translation.y;
        var x3 = c.translation.x;
        var y3 = c.translation.y;

        var l1 = ((y2-y3)*(x-x3) + (x3-x2)*(y-y3)) / ((y2-y3)*(x1-x3) + (x3-x2)*(y1-y3));
        var l2 = ((y3-y1)*(x-x3) + (x1-x3)*(y-y3)) / ((y2-y3)*(x1-x3) + (x3-x2)*(y1-y3));
        var l3 = 1 - l1 - l2;

        return (l1 * a.fVal + l2 * b.fVal + l3 * c.fVal).toFixed(2);
    } 
    
    function updateEVal(edge, e) {
        mouse.x = e.clientX - offset.left;
        mouse.y = e.clientY - offset.top;

        var a = edge.rect.vertices[0];
        var b = edge.rect.vertices[1];
        var c = edge.rect.vertices[2];
        var d = edge.rect.vertices[3];

        var d1 = pDistance(mouse.x, mouse.y, a.x, a.y, b.x, b.y);
        var d2 = pDistance(mouse.x, mouse.y, c.x, c.y, d.x, d.y);

        var l1 = d1 / (d1+d2);
        var l2 = d2 / (d1+d2);

        $fVal.val((l2*verts.children[edge.faces[0]].fVal + l1*verts.children[edge.faces[1]].fVal).toFixed(2));
    }

    function computeDual() {
        $.each(verts.children, function(i, vert) {
            var fVal = vert.fVal;
            $.each(vert.cofaces, function(j, e) {
                var edge = edges.children[e];
                fVal -= edge.fVal;
                var triVal = 0;
                $.each(edge.cofaces, function(k, t) {
                    var tri = tris.children[t];
                    triVal += tri.fVal;
                });
                fVal += triVal/2;
            });
            vert.fVal = fVal;
            recolor(fVal);
        });
        $.each(edges.children, function(i, edge) {
            var fVal = -edge.fVal;
            $.each(edge.cofaces, function(j, t) {
                var tri = tris.children[t];
                fVal += tri.fVal;
            });
            edge.fVal = fVal;
            recolor(fVal);
        });
    }

    function processCofaces() {
        $.each(verts.children, function(i, v) { 
            v.cofaces = [];
        });
        $.each(edges.children, function(i, e) {
            verts.children[e.faces[0]].cofaces.push(i);
            verts.children[e.faces[1]].cofaces.push(i);
            e.cofaces = [];
        });
        $.each(tris.children, function(i, t) {
            edges.children[t.oneFaces[0]].cofaces.push(i);
            edges.children[t.oneFaces[1]].cofaces.push(i);
            edges.children[t.oneFaces[2]].cofaces.push(i);
        });
    }

    function endStage() {
        switch (stage) {
            case 1:
                for (var i = 0; i < verts.children.length; i++) {
                    for (var j = i+1; j < verts.children.length; j++) {
                        var a = verts.children[i].translation,
                            b = verts.children[j].translation;
                        var edge = two.makeLine(a.x, a.y, b.x, b.y);

                        var v = new Two.Vector(-edge.vertices[0].y, edge.vertices[0].x);
                        var u = new Two.Vector(edge.vertices[0].x, edge.vertices[0].y);
                        var pt = new Two.Vector();
                        var rect = two.makePath();
                        v.setLength(RADIUS);
                        pt.add(v, u);
                        v.multiplyScalar(2);
                        u.multiplyScalar(2);
                        rect.vertices.push(new Two.Anchor(pt.x, pt.y));
                        pt.subSelf(v);
                        rect.vertices.push(new Two.Anchor(pt.x, pt.y));
                        pt.subSelf(u);
                        rect.vertices.push(new Two.Anchor(pt.x, pt.y));
                        pt.addSelf(v);
                        rect.vertices.push(new Two.Anchor(pt.x, pt.y));
                        rect.translation.copy(edge.translation);
                        rect.noStroke().noFill();
                        rects.add(rect);

                        edge.stroke = GRAY;
                        edge.opacity = 0;
                        edge.faces = [i, j];
                        edge.linewidth = LINEWIDTH;
                        edge.dim = 1;
                        edge.placed = false;
                        edges.add(edge);

                        two.update();
                        edge.rect = rect;
                        bindEdge(edge);
                    }
                }
                
                $canvas.unbind('mousedown');
                stage = 2;
                break;

            case 2:
                var rectsToRemove = [];
                var edgesToRemove = [];
                $.each(edges.children, function(i, edge) {
                    if (!edge.placed) {
                        rectsToRemove.push(edge.rect);
                        edgesToRemove.push(edge);
                    }
                });
                edges.remove(edgesToRemove);
                rects.remove(rectsToRemove);

                $.each(adj, function(i, js) {
                    i = parseInt(i);
                    $.each(js, function (_j, j) {
                        if (j > i) {
                            $.each(adj[j], function(_k, k) {
                                if (k > j) {
                                    $.each(adj[k], function(_l, l) {
                                        if (i == l) {
                                            var a = verts.children[i].translation,
                                                b = verts.children[j].translation,
                                                c = verts.children[k].translation
                                            var containsVert = false;
                                            $.each(verts.children, function(x, v) {
                                                if (!(x in [i, j, k]))
                                                    containsVert = containsVert || pInTri(v.translation.x, v.translation.y, a.x, a.y, b.x, b.y, c.x, c.y);
                                            });
                                            if (!containsVert) {
                                                var tri = two.makePath(a.x, a.y, b.x, b.y, c.x, c.y);
                                                tri.noStroke();
                                                tri.fill = GRAY;
                                                tri.opacity = 0;
                                                tri.dim = 2;
                                                tri.placed = false;

                                                var faces = [];
                                                $.each(edges.children, function(e, edge) {
                                                    if ([i, j, k].includes(edge.faces[0]) && [i, j, k].includes(edge.faces[1]))
                                                        faces.push(e);
                                                });
                                                tri.oneFaces = faces;
                                                tri.zeroFaces = [i, j, k];

                                                tris.add(tri);

                                                two.update();
                                                bindTri(tri);
                                            }
                                        }
                                    })
                                }
                            })
                        }
                    })
                });

                stage = 3;
                break;

            case 3:
                trisToRemove = [];
                $.each(tris.children, function(i, tri) {
                    if (!tri.placed) trisToRemove.push(tri);
                });
                tris.remove(trisToRemove);

                processCofaces();

                $("#integrate").bind('change', function(e) {
                    e.preventDefault();
                    if (this.checked) {
                        $("#extend").prop("disabled", true);
                        $("#dual").prop("disabled", true);
                        $("#integral").show();
                        $.each($.merge($.merge($.merge([], verts.children), edges.children), tris.children), function (i, simp) {
                            bindInt(simp);
                        });
                    }
                    else {
                        $("#extend").prop("disabled", false);
                        $("#dual").prop("disabled", false);
                        $("#integral").hide();
                        $.each($.merge($.merge($.merge([], verts.children), edges.children), tris.children), function (i, simp) {
                            unbindInt(simp);
                        });
                    }
                }).parent().removeClass("disabled");
                $("#extend").prop("disabled", false).bind('click', function(e) {
                    e.preventDefault();
                    $("#integrate").parent().addClass("disabled");
                    $("#dual").prop("disabled", true);
                    $.each(edges.children, function (i, edge) { extendEdge(edge); });
                    $.each(tris.children, function (i, tri) { extendTri(tri); });
                    $(this).prop("disabled", true);
                });
                $("#dual").prop("disabled", false).bind('click', function(e) {
                    e.preventDefault();
                    computeDual()
                });
                $fVal.prop("disabled", true);

                $.each(verts.children, function (i, vert) {
                    $(vert._renderer.elem).bind('mouseover', function(e) {
                        e.preventDefault();
                        $fVal.val(vert.fVal);
                    });
                });
                $.each(tris.children, function (i, tri) {
                    $(tri._renderer.elem).bind('mouseover', function(e) {
                        e.preventDefault();
                        $fVal.val(tri.fVal);
                    });
                });
                $.each(edges.children, function (i, edge) {
                    $(edge.rect._renderer.elem).bind('mouseover', function(e) {
                        e.preventDefault();
                        $fVal.val(edge.fVal);
                    });
                });

                break;
        }

        two.update();
    }

    function bindEdge(edge) {
        $(edge.rect._renderer.elem).bind('mouseover', function(e) {
            e.preventDefault();
            edge.opacity = 1;
            two.update();
        });
        $(edge.rect._renderer.elem).bind('mouseout', function(e) {
            e.preventDefault();
            edge.opacity = 0;
            two.update();
        });
        $(edge.rect._renderer.elem).bind('mousedown', function(e) {
            e.preventDefault();
            var fVal = parseInt($fVal.val());
            edge.placed = true
            edge.fVal = fVal;
            recolor(fVal);

            var a = edge.faces[0],
                b = edge.faces[1];
            if (a in adj) adj[a].push(b);
            else adj[a] = [b];
            if (b in adj) adj[b].push(a);
            else adj[b] = [a];

            $(edge.rect._renderer.elem).unbind();

            var rectsToRemove = [];
            var edgesToRemove = [];
            $.each(edges.children, function(i, tempEdge) {
                if (doIntersect(verts.children[a].translation, verts.children[b].translation, verts.children[tempEdge.faces[0]].translation, verts.children[tempEdge.faces[1]].translation)) {
                    rectsToRemove.push(tempEdge.rect);
                    edgesToRemove.push(tempEdge);
                }
            });
            edges.remove(edgesToRemove);
            rects.remove(rectsToRemove);

            $fVal.val(maxF).select();
            two.update();
        });
    }

    function bindTri(tri) {
        $(tri._renderer.elem).bind('mouseover', function(e) {
            e.preventDefault();
            tri.opacity = 1;
            two.update();
        });
        $(tri._renderer.elem).bind('mouseout', function(e) {
            e.preventDefault();
            tri.opacity = 0;
            two.update();
        });
        $(tri._renderer.elem).bind('mousedown', function(e) {
            e.preventDefault();
            var fVal = parseInt($fVal.val());
            tri.placed = true;
            tri.fVal = fVal;
            recolor(fVal);
            $fVal.val(maxF).select();

            $(tri._renderer.elem).unbind();
        });
    }


});

function distance(p, q) {
    return Math.sqrt(Math.pow(p.x-q.x, 2) + Math.pow(p.y-q.y, 2));
}

function pDistance(x, y, x1, y1, x2, y2) {
  var A = x - x1;
  var B = y - y1;
  var C = x2 - x1;
  var D = y2 - y1;

  var dot = A * C + B * D;
  var len_sq = C * C + D * D;
  var param = -1;
  if (len_sq != 0)
      param = dot / len_sq;

  var xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  }
  else if (param > 1) {
    xx = x2;
    yy = y2;
  }
  else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  var dx = x - xx;
  var dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

function pInTri(px,py,ax,ay,bx,by,cx,cy) {
    var v0 = [cx-ax,cy-ay];
    var v1 = [bx-ax,by-ay];
    var v2 = [px-ax,py-ay];

    var dot00 = (v0[0]*v0[0]) + (v0[1]*v0[1]);
    var dot01 = (v0[0]*v1[0]) + (v0[1]*v1[1]);
    var dot02 = (v0[0]*v2[0]) + (v0[1]*v2[1]);
    var dot11 = (v1[0]*v1[0]) + (v1[1]*v1[1]);
    var dot12 = (v1[0]*v2[0]) + (v1[1]*v2[1]);

    var invDenom = 1/ (dot00 * dot11 - dot01 * dot01);

    var u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    var v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    return ((u >= 0) && (v >= 0) && (u + v < 1));
}

function onSegment(p, q, r) {
    if (q.x < Math.max(p.x, r.x) && q.x > Math.min(p.x, r.x) &&
        q.y < Math.max(p.y, r.y) && q.y > Math.min(p.y, r.y))
        return true;
 
    return false
}

function orientation(p, q, r)
{
    var val = (q.y - p.y) * (r.x - q.x) -
              (q.x - p.x) * (r.y - q.y);
 
    if (val == 0) return 0;
 
    return (val > 0)? 1: 2;
}

function doIntersect(p1, q1, p2, q2)
{
    var o1 = orientation(p1, q1, p2);
    var o2 = orientation(p1, q1, q2);
    var o3 = orientation(p2, q2, p1);
    var o4 = orientation(p2, q2, q1);

    if (p1 == p2 || p1 == q2 || q1 == p2 || q1 == q2) return false;
 
    if (o1 != o2 && o3 != o4)
        return true;
 
    if (o1 == 0 && onSegment(p1, p2, q1)) return true;
 
    if (o2 == 0 && onSegment(p1, q2, q1)) return true;
 
    if (o3 == 0 && onSegment(p2, p1, q2)) return true;
 
    if (o4 == 0 && onSegment(p2, q1, q2)) return true;
 
    return false;
}
