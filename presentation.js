const scrolly = d3.select("#scrolly");
const figure = scrolly.select("figure");
const article = scrolly.select("article");
const step = article.selectAll(".step");

const scroller = scrollama();

function handleResize() {
    const stepH = Math.floor(window.innerHeight * 0.70);
    step.style("height", stepH + "px");

    const figureHeight = window.innerHeight - 50;
    const figureMarginTop = 25;

    figure.style("height", figureHeight + "px")
        .style("top", figureMarginTop + "px");

    scroller.resize();
}




function init() {
    loadData.then(function () {
        handleResize();
        scroller
            .setup({
                step: "#scrolly article .step",
                offset: 0.33,
                debug: false
            })
            .onStepEnter(handleStepEnter);
    });
    dernier = -1;
}
init();


/* **************************************************************************
*                          TRANSITIONS
* ***************************************************************************/

var dernier = -1;
var pointsFinaux = [];
function handleStepEnter(response) {
    if (response.index == dernier) {
        return;
    } else {
        dernier = response.index;
    }
    console.log(response);

    step.classed("is-active", function (d, i) {
        return i === response.index;
    });

    if (ptsSUISSES == null ) {
        response.index = 0;
    }

    switch (response.index) {
        case 0:
            
            doZoom(ZOOM_FACTOR_SUISSE);
            AfficheMonde();

            if (ptsSUISSES.length == 0) {
                creeLesSuisses();
            } else if (response.direction == "up") {
                retourDesSuisses(TYPE_EUROPE);
                retourDesSuisses(TYPE_MONDE);
            }


            break;
        case 1:

            doZoom(ZOOM_FACTOR_EUROPE)
            if (response.direction == "up") {
                retourDesSuisses(TYPE_MONDE);
            } else {
                emigreSuisses(TYPE_EUROPE);
            }

            break;
        case 2:

            if (response.direction == "up") {
                effaceGraph();
                emigreSuisses(TYPE_EUROPE);
            }
            emigreSuisses(TYPE_MONDE);
            doZoom(ZOOM_FACTOR_MONDE);
            break;
        case 3:
            if (response.direction == "up") {
                enleveSalutations();
            }
            doZoom(ZOOM_FACTOR_GRAPH);
            afficheGraph();
            break;
        case 4:
            if (response.direction == "up") {
                doMoveAndZoom(projection(CENTRE_MONDE), ZOOM_FACTOR_MONDE);
            } else {
                effaceGraph();
                doZoom(ZOOM_FACTOR_MONDE);
                pointsFinaux = montreChiffre("27");
            }
            break;
        case 5:
            doMoveAndZoom(pointsFinaux[0], ZOOM_FACTOR_SUISSE);
            break;
        case 6:
            doMoveAndZoom(pointsFinaux[1], ZOOM_FACTOR_SUISSE);
            break;
    }


}