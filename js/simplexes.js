const RADIUS = 10;
const LINEWIDTH = RADIUS/4;
const GRAY = "#D3D3D3";
const RESOLUTION = 4;
const INT_TEX = "\\int_X f\\ \\operatorname{d}\\chi = "
const POS_COLOR = {
    r : 210,
    g : 120,
    b : 5
};
const NEG_COLOR = {
    r : 20,
    g : 54,
    b : 109
};

$(() => {
    var QUEUE = MathJax.Hub.queue;
    var math = null;
    QUEUE.Push(() => { math = MathJax.Hub.getAllJax("integral")[0]; });    

    var canvas = document.getElementById("canvas");
    var two = new Two({
        width: $(canvas).width(),
        height: $(window).height(),
    }).appendTo(canvas);
    var $canvas = $("svg"),
        $fVal = $("#f-val");
    var offset  = $canvas.offset();

    var stage, maxF, intVal, label, vertMarker, auxTris, tris, edges, rects, verts, mouse;

    $(document).keypress(e => { if(e.which == 13) endStage(); });

    reset();

    function reset() {
        two.clear();
        $("*").unbind();

        $canvas.contextmenu(e => { e.preventDefault() });
        $("#reset").click(reset);

        createGrid();
        stage = 1;
        intVal = 0;
        auxTris = two.makeGroup(),
        tris = two.makeGroup(),
        edges = two.makeGroup(),
        rects = two.makeGroup(),
        verts = two.makeGroup();
        $fVal.prop("disabled", false);
        $("#dual").prop("disabled", true); 
        $("#extend").prop("disabled", true); 
        $("#integrate").prop("checked", false).parent().addClass("disabled").removeClass("active");
        $("#integral").hide().parent();

        mouse = new Two.Anchor();
        maxF = -Infinity;
        $fVal.val(1).select();
        vertMarker = two.makeCircle(0, 0, RADIUS);
        vertMarker.opacity = 0.2;
        vertMarker.fill = "black";
        vertMarker.noStroke();
        label = new Two.Text("Click to add a vertex. Press enter to start adding edges.", two.width/2, two.height - 50, {family: "'Helvetica Neue', Helvetica, Arial, sans-serif"});
        label.fill = "black";
        label.size = 20;
        two.add(label);
        two.update();
        $canvas.mousedown(e => {
            e.preventDefault();
            addVertex(e);
        });
        $canvas.mousemove(e => {
            mouse.x = e.clientX - offset.left;
            mouse.y = e.clientY - offset.top;
            vertMarker.translation.set(mouse.x, mouse.y);
            two.update();
        });

        $("#reeb").hide();
        $("#reeb svg").remove();
    }

    function addVertex(e) {
        var fVal = parseFloat($fVal.val());
        if (!isNaN(fVal)) {
            var vert = two.makeCircle(mouse.x, mouse.y, RADIUS);
            vert.fVal = fVal;
            vert.dim = 0;
            vert.adj = [];
            vert.lowerEdges = [];
            vert.upperEdges = [];
            vert.equiEdges = [];
            vert.cotris = [];
            vert.placed = true;
            vert.processed = false;

            verts.children.forEach(vert2 => {
                var [a, b] = [vert, vert2].sort((a, b) => { return a.fVal - b.fVal; });

                var edge = two.makeLine(a.translation.x, a.translation.y, b.translation.x, b.translation.y);

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
                edge.faces = [a, b];
                edge.linewidth = LINEWIDTH;
                edge.dim = 1;
                edge.placed = false;
                edges.add(edge);

                two.update();
                edge.rect = rect;
            });

            verts.add(vert);
            recolor(fVal);
        }

        $fVal.val(maxF).select();
        two.update();
    }

    function computeReeb() {
        var reeb = new graphlib.Graph({ multigraph: true });
        var compMap = new Map();

        var preimage = new graphlib.Graph();
        edges.children.forEach(edge => {
            if (!edge.isEquiedge) preimage.setNode(edge.id);
        });

        var components = graphlib.alg.components(preimage);

        verts.children.forEach(vert => {
            if (!vert.processed) {
                vert.processed = true;

                var equiVerts = [vert];
                var stack = [vert]
                while (stack.length > 0) {
                    var currentV = stack.pop();
                    currentV.equiEdges.forEach(equiEdge => {
                        equiEdge.faces.forEach(equiV => {
                            if (!equiV.processed) {
                                equiV.processed = true;
                                equiVerts.push(equiV);
                                stack.push(equiV);
                            }
                        });
                    });
                }

                var lowerComps = new Set();
                equiVerts.forEach(equiV => {
                    lowerComps = new Set([...lowerComps, ...getLowerComps(equiV, components)]);
                });

                // update preimage
                vert.cotris.forEach(tri => {
                    if (vert == tri.zeroFaces[0]) preimage.setEdge(tri.oneFaces[0].id, tri.oneFaces[1].id);
                    else if (tri.zeroFaces[0] == tri.zeroFaces[1] || tri.zeroFaces[1] == tri.zeroFaces[2]) {
                        if (vert == tri.zeroFaces[2] && tri.processed) preimage.removeEdge(tri.oneFaces[0].id, tri.oneFaces[1].id);
                        else tri.processed = true;
                    }
                    else {
                        if (vert == tri.zeroFaces[1]) {
                            preimage.removeEdge(tri.oneFaces[0].id, tri.oneFaces[1].id);
                            preimage.setEdge(tri.oneFaces[1].id, tri.oneFaces[2].id);
                        }
                        else preimage.removeEdge(tri.oneFaces[1].id, tri.oneFaces[2].id);
                    }
                });

                components = graphlib.alg.components(preimage);

                var upperComps = new Set();
                equiVerts.forEach(equiV => {
                    upperComps = new Set([...upperComps, ...getUpperComps(equiV, components)]);
                });

                //update reeb
                if (upperComps.size != lowerComps.size || upperComps.size != 1) {
                    reeb.setNode(reeb.nodeCount(), vert.fVal);
                    upperComps.forEach(upperComp => {
                        compMap.set(upperComp, reeb.nodeCount()-1);
                    });
                    lowerComps.forEach(lowerComp => {
                        reeb.setEdge(reeb.nodeCount()-1, compMap.get(lowerComp), "", lowerComp);
                    });
                }
                else if (upperComps.size == 1) {
                    compMap.set(upperComps.values().next().value, compMap.get(lowerComps.values().next().value));
                }
            }
        });

        var graph_serialized = graphlib.json.write(reeb);
        var nodes = graph_serialized["nodes"];
        var links = graph_serialized["edges"];

        var width = $("#reeb").show().innerWidth(),
            height = 400;

        var y_max = d3.max(nodes, d => { return d.value; }),
            y_min = d3.min(nodes, d => { return d.value; });

        var y = d3.scale.linear()
            .domain([y_max, y_min])
            .range([20, height-20]);

        var nodesMap = d3.map();
        nodes.forEach(n => { nodesMap.set(n.v, n); });

        var linkcount = new Map();

        links.forEach(l => {
            var [from, to] = [l.v, l.w].sort();
            var id = `${from}-${to}`;
            if (linkcount.has(id)) linkcount.set(id, linkcount.get(id) + 1);
            else linkcount.set(id, 1);

            l.source = nodesMap.get(l.v);
            l.target = nodesMap.get(l.w);
        });

        links.sort((a, b) => {
            if (a.source > b.source) return 1;
            else if (a.source < b.source) return -1;
            else {
                if (a.target > b.target) return 1;
                if (a.target < b.target) return -1;
                else return 0;
            }
        });

        for (var i=0; i<links.length; i++) {
            if (i != 0 &&
                links[i].source == links[i-1].source &&
                links[i].target == links[i-1].target)
                links[i].linknum = links[i-1].linknum + 1;
            else links[i].linknum = 1;
        };

        var force = d3.layout.force()
            .size([width, height]);

        var svg = d3.select("#reeb").append("svg")
            .attr("width", width)
            .attr("height", height);

        var g = svg.append("g");

        force.nodes(nodes)
            .links(links)
            .start();

        var link = g.selectAll("path")
            .data(links)
            .enter().append("path")
            .attr("class", "link");

        var node = g.selectAll("circle")
            .data(nodes)
            .enter().append("circle")
            .attr("r", 6)
            .style("fill", d => { return compColor(d.value); } )
            .on("mouseover", d => { $fVal.val(d.value) })
            .call(force.drag);

        function linkArc(d) {
            var [from, to] = [d.source.v, d.target.v].sort();
            var count = linkcount.get(`${from}-${to}`);
            var dx = d.target.x - d.source.x,
                dy = y(d.target.value) - y(d.source.value);
            var dr;
            if (count % 2 == 1 && d.linknum == count) dr = 0;
            else dr = Math.sqrt(dx * dx + dy * dy) / (parseInt((d.linknum-1)/2)+1) * 2;
            var dir = (d.linknum % 2 == 0) * 1;
            return `M ${d.source.x} ${y(d.source.value)} A ${dr} ${dr}, 0, 0, ${dir}, ${d.target.x} ${y(d.target.value)}`;
        }

        force.on("tick", () => {
            link.attr("d", linkArc);

            node.attr("cx", d => { return d.x; })
                .attr("cy", d => { return y(d.value); });
        });
    }

    function getLowerComps(vert, components) {
        var lowerComps = new Set();
        vert.lowerEdges.forEach(lowerEdge => {
            var representative;
            components.forEach(component => {
                if (component.includes(lowerEdge.id))
                    representative = component[0];
            });
            lowerComps.add(representative);
        });
        return lowerComps;
    }

    function getUpperComps(vert, components) {
        var upperComps = new Set();
        vert.upperEdges.forEach(upperEdge => {
            var representative;
            components.forEach(component => {
                if (component.includes(upperEdge.id))
                    representative = component[0];
            });
            upperComps.add(representative);
        });
        return upperComps;
    }

    function bindInt(simp) {
        setBW(simp);
        if (simp.dim == 1) elem = $(simp.rect._renderer.elem);
        else elem = $(simp._renderer.elem);
        elem.on("mouseover.int", () => {
            if (simp.inInt) setBW(simp);
            else setColor(simp);
        }).on("mouseout.int", () => {
            if (simp.inInt) setColor(simp);
            else setBW(simp);
        }).on("mousedown.int", () => {
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

            QUEUE.Push(["Text", math, INT_TEX+intVal]);
            two.update();
        });
    }

    function unbindInt(simp) {
        setColor(simp);
        simp.inInt = false;
        if (simp.dim == 1) elem = $(simp.rect._renderer.elem);
        else elem = $(simp._renderer.elem);
        elem.unbind(".int");
    }

    function recolor(fVal) {
        maxF = Math.max(Math.abs(fVal), maxF);

        $.merge($.merge($.merge([], verts.children), edges.children), tris.children).forEach(simp => {
            if (simp.placed) setColor(simp);
        });
    }

    function setBW(simp) {
        if (simp.fVal > 0) var c = 255 - Math.round(255 * simp.fVal / maxF);
        else var c = 255 - Math.round(255 * simp.fVal / (-maxF));
        simp.stroke = simp.fill = `rgb(${c}, ${c}, ${c})`;
        two.update();
    }

    function setColor(simp) {
        simp.stroke = simp.fill = compColor(simp.fVal);
        two.update();
    }

    function compColor(fVal) {
        if (fVal > 0) {
            var ratio = fVal / maxF;
            var r = Math.round(POS_COLOR.r + (1-ratio) * (255-POS_COLOR.r));
            var g = Math.round(POS_COLOR.g + (1-ratio) * (255-POS_COLOR.g));
            var b = Math.round(POS_COLOR.b + (1-ratio) * (255-POS_COLOR.b));
        }
        else {
            var ratio = -fVal / maxF;
            var r = Math.round(NEG_COLOR.r + (1-ratio) * (255-NEG_COLOR.r));
            var g = Math.round(NEG_COLOR.g + (1-ratio) * (255-NEG_COLOR.g));
            var b = Math.round(NEG_COLOR.b + (1-ratio) * (255-NEG_COLOR.b));
        }
        return `rgb(${r}, ${g}, ${b})`;
    }

    function extendEdge(edge) {
        var fVal1 = edge.faces[0].fVal,
            fVal2 = edge.faces[1].fVal;

        var stops = [new Two.Stop(0, compColor(fVal1), 1)];
        if (fVal1 * fVal2 < 0)
            stops.push(new Two.Stop(Math.abs(fVal1)/(Math.abs(fVal1)+Math.abs(fVal2)), "white", 1));
        stops.push(new Two.Stop(1, compColor(edge.faces[1].fVal), 1));

        edge.stroke = new Two.LinearGradient(edge.vertices[0].x, edge.vertices[0].y, edge.vertices[1].x, edge.vertices[1].y, stops);

        two.update();

        $(edge.rect._renderer.elem).unbind("mouseover").mousemove(e => {
            mouse.x = e.clientX - offset.left;
            mouse.y = e.clientY - offset.top;
            $fVal.val(calcEF(edge, mouse.x, mouse.y));
        });
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

        return (l2*edge.faces[0].fVal + l1*edge.faces[1].fVal).toFixed(2);
    }

    function extendTri(tri) {
        tri.opacity = 0;
        subdivTri(tri, 1, tri);

        two.update();

        $(tri._renderer.elem).unbind("mouseover").mousemove(e => {
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

        if (i < RESOLUTION) {
            subdivTri(t1, i+1, realTri);
            subdivTri(t2, i+1, realTri);
            subdivTri(t3, i+1, realTri);
            subdivTri(t4, i+1, realTri);
        }
        else {
            t1.fVal = calcTF(realTri, t1.translation.x, t1.translation.y);
            setColor(t1);
            t2.fVal = calcTF(realTri, t2.translation.x, t2.translation.y);
            setColor(t2);
            t3.fVal = calcTF(realTri, t3.translation.x, t3.translation.y);
            setColor(t3);
            t4.fVal = calcTF(realTri, t4.translation.x, t4.translation.y);
            setColor(t4);
            two.update();
        }
    }

    function calcTF(tri, x, y) {
        var a = tri.zeroFaces[0];
        var b = tri.zeroFaces[1];
        var c = tri.zeroFaces[2];

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

    function computeDual() {
        verts.children.forEach(vert => {
            var fVal = vert.fVal;
            $.merge($.merge([], vert.lowerEdges), vert.upperEdges).forEach(edge => {
                fVal -= edge.fVal;
                var triVal = 0;
                edge.cofaces.forEach(tri => { triVal += tri.fVal; });
                fVal += triVal/2;
            });
            vert.fVal = fVal;
            recolor(fVal);
        });
        edges.children.forEach(edge => {
            var fVal = -edge.fVal;
            edge.cofaces.forEach(tri => { fVal += tri.fVal; });
            edge.fVal = fVal;
            recolor(fVal);
        });
    }

    function endStage() {
        switch (stage) {
            case 1:
                verts.children.sort((u, v) => { return u.fVal - v.fVal; });

                vertMarker.opacity = 0;
                edges.children.forEach(edge => { bindEdge(edge); });

                label.value = "Click to add an edge. Press enter to start adding faces.";
                $canvas.unbind();
                stage = 2;
                break;

            case 2:
                var rectsToRemove = [];
                var edgesToRemove = [];
                edges.children.forEach(edge => {
                    if (!edge.placed) {
                        rectsToRemove.push(edge.rect);
                        edgesToRemove.push(edge);
                    }
                });
                edges.remove(edgesToRemove);
                rects.remove(rectsToRemove); 

                tris.children.forEach(tri => { bindTri(tri); });

                label.value = "Click to add a face. Press enter to finish.";
                stage = 3;
                break;

            case 3:
                trisToRemove = [];
                tris.children.forEach(tri => { if (!tri.placed) trisToRemove.push(tri); });
                tris.remove(trisToRemove);


                $("#integrate").on("change", () => {
                    if (!$("#integrate").parent().hasClass("disabled")) {
                        if ($("#integrate").prop("checked")) {
                            label.value = "Click on a simplex to add it to X.";
                            $("#extend").prop("disabled", true);
                            $("#dual").prop("disabled", true);
                            $("#integral").show();
                            $.merge($.merge($.merge([], verts.children), edges.children), tris.children).forEach(simp => {
                                bindInt(simp);
                            });
                        }
                        else {
                            label.value = "";
                            $("#extend").prop("disabled", false);
                            $("#dual").prop("disabled", false);
                            $("#integral").hide();
                            intVal = 0;
                            QUEUE.Push(["Text", math, INT_TEX+intVal]);
                            $.merge($.merge($.merge([], verts.children), edges.children), tris.children).forEach(simp => {
                                unbindInt(simp);
                            });
                            $("#eul").html(0);
                        }
                    }
                }).parent().removeClass("disabled");
                $("#extend").prop("disabled", false).on("click", () => {
                    $("#integrate").parent().addClass("disabled");
                    $("#dual").prop("disabled", true);
                    edges.children.forEach(edge => { extendEdge(edge); });
                    tris.children.forEach(tri => { extendTri(tri); });
                    computeReeb();
                    $("#extend").prop("disabled", true);
                });
                $("#dual").prop("disabled", false).on("click", () => {
                    computeDual()
                });
                $fVal.prop("disabled", true);

                verts.children.forEach(vert => {
                    $(vert._renderer.elem).mouseover(() => { $fVal.val(vert.fVal); });
                });
                tris.children.forEach(tri => {
                    $(tri._renderer.elem).mouseover(() => { $fVal.val(tri.fVal); });
                });
                edges.children.forEach(edge => {
                    $(edge.rect._renderer.elem).mouseover(() => { $fVal.val(edge.fVal); });
                });

                label.value = "";

                stage = 4;

                break;
        }

        two.update();
    }

    function bindEdge(edge) {
        $(edge.rect._renderer.elem).mouseover(() => {
            edge.opacity = 1;
            two.update();
        }).mouseout(() => {
            edge.opacity = 0;
            two.update();
        }).mousedown(e => {
            e.preventDefault();
            var fVal = parseInt($fVal.val());
            edge.placed = true
            edge.fVal = fVal;
            edge.cofaces = [];
            edge.isEquiedge = false;
            recolor(fVal);

            var i = edge.faces[0],
                j = edge.faces[1];

            if (i.fVal > j.fVal) {
                i.lowerEdges.push(edge);
                j.upperEdges.push(edge);
            }
            else if (i.fVal < j.fVal) {
                j.lowerEdges.push(edge);
                i.upperEdges.push(edge);
            }
            else {
                i.equiEdges.push(edge);
                j.equiEdges.push(edge);
                edge.isEquiedge = true;
            }

            i.adj.forEach(k => {
                if (j.adj.includes(k)) {
                    var [a, b, c] = [i, j, k].sort((a, b) => { return a.fVal - b.fVal; });
                    var containsVert = false;
                    verts.children.forEach(v => {
                        if (![a, b, c].includes(v))
                            containsVert = containsVert ||
                                pInTri(v.translation.x, v.translation.y,
                                    a.translation.x, a.translation.y,
                                    b.translation.x, b.translation.y,
                                    c.translation.x, c.translation.y);
                    });
                    if (!containsVert) {
                        var tri = two.makePath(a.translation.x, a.translation.y, b.translation.x, b.translation.y, c.translation.x, c.translation.y);
                        tri.noStroke();
                        tri.fill = GRAY;
                        tri.opacity = 0;
                        tri.dim = 2;
                        tri.placed = false;
                        tri.processed = false;

                        var faces = [];
                        edges.children.forEach(edge => {
                            if ([a, b, c].includes(edge.faces[0]) && [a, b, c].includes(edge.faces[1]))
                                faces.push(edge);
                        });
                        faces.sort((a, b) => {
                            if (a.faces[0] == b.faces[0]) return a.faces[1].fVal - b.faces[1].fVal;
                            return a.faces[0].fVal - b.faces[0].fVal;
                        });
                        tri.oneFaces = faces;
                        tri.zeroFaces = [a, b, c];

                        tris.add(tri);
                    }
                }
            });

            i.adj.push(j);
            j.adj.push(i);

            $(edge.rect._renderer.elem).unbind();

            var rectsToRemove = [];
            var edgesToRemove = [];
            edges.children.forEach(tempEdge => {
                if (doIntersect(i.translation, j.translation, tempEdge.faces[0].translation, tempEdge.faces[1].translation)) {
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
        $(tri._renderer.elem).mouseover(() => {
            tri.opacity = 1;
            two.update();
        }).mouseout(() => {
            tri.opacity = 0;
            two.update();
        }).mousedown(e => {
            e.preventDefault();
            var fVal = parseInt($fVal.val());
            tri.placed = true;
            tri.fVal = fVal;
            tri.oneFaces.forEach(edge => { edge.cofaces.push(tri); });
            tri.zeroFaces.forEach(vert => { vert.cotris.push(tri); });
            recolor(fVal);
            $fVal.val(maxF).select();

            $(tri._renderer.elem).unbind();
        });
    }

    function createGrid() {

        var size = 30;
        var bg = new Two({
            type: Two.Types.canvas,
            width: size,
            height: size
        });

        var a = bg.makeLine(bg.width / 2, 0, bg.width / 2, bg.height);
        var b = bg.makeLine(0, bg.height / 2, bg.width, bg.height / 2);
        a.stroke = b.stroke = "#e5efff";

        bg.update();

        $canvas.css({
            background: `url( ${bg.renderer.domElement.toDataURL("image/png")} ) 0 0 repeat`,
            backgroundSize: `${size}px ${size}px`
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

    return (u >= 0) && (v >= 0) && (u + v < 1);
}

function onSegment(p, q, r) {
    return q.x < Math.max(p.x, r.x) && q.x > Math.min(p.x, r.x) &&
        q.y < Math.max(p.y, r.y) && q.y > Math.min(p.y, r.y);
}

function orientation(p, q, r)
{
    var val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (val == 0) return 0;
    return (val > 0) ? 1 : 2;
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

    return (o1 == 0 && onSegment(p1, p2, q1)) ||
        (o2 == 0 && onSegment(p1, q2, q1)) ||
        (o3 == 0 && onSegment(p2, p1, q2)) ||
        (o4 == 0 && onSegment(p2, q1, q2));
}
