
/**
 * Mélange un tableau
 * @param {*} array Le tableu à mélanger
 * @returns 
 */
function shuffle(array) {
    let currentIndex = array.length, randomIndex;

    while (currentIndex != 0) {

        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}


/**
 * Retourne un tableu de points (x,y) aléatoires tous dans un polygone
 * @param {*} polygon Le polygone contenant tous les points
 * @param {*} nbPoints Le nombre de points
 * @returns 
 */
function getPointInside(polygon, nbPoints) {
    var bench = getBench(polygon);
    var deltaX = bench[2] - bench[0];
    var deltaY = bench[3] - bench[1];

    var tabPoints = [];
    for (var i = 0; i < nbPoints; i++) {
        var pX;
        var pY;
        do {
            pX = Math.random() * deltaX + bench[0];
            pY = Math.random() * deltaY + bench[1];

            // on remplace polygonContains par d3.polygonContains
        } while (!d3.polygonContains(polygon, [pX, pY]));
        /*
        * Transforme un point [x,y] en object pour pouvois stocker des info (eg, sex)
        */
        var unPoint = {}
        unPoint.coordonnee = [pX, pY];
        tabPoints.push(unPoint);
    }

    return tabPoints;
}


/**
 * Retourne le plus petit rectange possible autour d'un polygone.
 * Necessaire pour getPointInside()
 * @param {*} polygon 
 * @returns 
 */
function getBench(polygon) {
    var minX = polygon[0][0];
    var minY = polygon[0][1];
    var maxX = polygon[0][0];
    var maxY = polygon[0][1];

    var length = polygon.length;

    for (var i = 1; i < length; i++) {
        if (polygon[i][0] < minX) {
            minX = polygon[i][0];
        } else if (polygon[i][0] > maxX) {
            maxX = polygon[i][0];
        }
        if (polygon[i][1] < minY) {
            minY = polygon[i][1];
        } else if (polygon[i][1] > maxY) {
            maxY = polygon[i][1];
        }
    }

    return [minX, minY, maxX, maxY];
}

/* ********************************************************
*                       Zoom
***********************************************************/

const zoom = d3.zoom()
    .on('zoom', handleZoom);



function handleZoom(e) {
    SVG_MONDE
        .attr('transform', e.transform);
}


const ZOOM_FACTOR_SUISSE = 1;
const ZOOM_FACTOR_EUROPE = 0.05;
const ZOOM_FACTOR_MONDE = 0.013;
const ZOOM_FACTOR_GRAPH = 1.5;

let zoomFactor = 1;

/**
 * Zoom et bouge vers un point donné
 * @param {*} versPoint 
 * @param {*} factor 
 */
function doMoveAndZoom(versPoint, factor) {

    zoomFactor = factor;

    x = versPoint[0] * factor;
    y = versPoint[1] * factor;

    var t = d3.zoomIdentity.translate(-x + WIDTH / 2, -y + HEIGHT / 2).scale(factor);

    SVG_MONDE
        .transition()
        .duration(3000)
        .call(zoom.transform, t);
}

/**
 * Zoom, Si le facteur est identique au précédent, ne fait rien
 * @param {*} factor 
 */
function doZoom(factor) {
    if (zoomFactor != factor) {

        zoomFactor = factor;

        SVG_MONDE
            .transition()
            .duration(3000)
            .call(zoom.scaleTo, factor)
    }

}






