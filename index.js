import * as d3 from './node_modules/d3/dist/d3.js';
import scrollama from './scrollama.js';

const SVG_MONDE = d3.select(".carteMonde");
const SVG_GRAPH = d3.select(".graph");

const WIDTH = 1400;
const HEIGHT = 800;

const CENTRE_MONDE = [8.23, 46.82]; // Centré sur la Suisse

const TYPE_EUROPE = "lesSuisses_Europe";
const TYPE_MONDE = "lesSuisses_Monde";
const TYPE_TOUS = "lesSuisses_Europe,.lesSuisses_Monde";
const DIVISEUR = 5;  // Pour ne pas avoir trop de points !

const mapPAYS = new Map(); // Map pour retrouver un pays plus rapidement
const mapCHIFFRES = new Map(); // Map pour retrouver un chiffre plus rapidement

export const ptsSUISSES = [];
const TOOLTIP = d3.select('.info');  // Selectionne-le une-fois pour toute.

import chiffres from './chiffres.json';
import stats from './stats.json';
import monde from './world.json';

/*
* Pour les transitions :
*/

let lesSuisses_Europe_enSuisse = true;
let lesSuisses_Monde_enSuisse = true;
let mondeCree = false;

/*
* Le type de projection, avec resize et recentrage sur la suisse.
*/
const projection = d3
  .geoMercator()
  .center(CENTRE_MONDE)
  .scale(15000)
  .translate([WIDTH / 2, HEIGHT / 2]);

let jsoWorld = {};
let jsoStatistics = {};

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

/**
* Chargement + préparations données :
*    - Pour les chiffres, re-calcul de la taille et position
*    - Pour les stats, calcul des données dont nous aurons besoins (nombre de points Europe, Monde, ...)
*    - Pour le monde, créer une Map() pour pouvoir retrouver un pays plus rapidement.
*/

export const loadData = () => {
  

    chiffres.features.forEach((element) => {
      let newPolygon = [];
      /*
      * Corrige la taille du chiffre
      */
      element.geometry.coordinates.forEach((coordonnee) => {
        let pX = coordonnee[0];
        let pY = coordonnee[1];
        if (element.properties.name == "a" || element.properties.name == "n" || element.properties.name == "s") {
          newPolygon.push([pX / 5 - 25, (-pY / 4) + 60]);
        } else {
          newPolygon.push([pX / 5 - 25, (-pY / 5) + 100]);
        }
      });
      let nomChiffre = element.properties.name;
      mapCHIFFRES.set(nomChiffre, newPolygon);
    });

    jsoWorld = monde; // Sauve pour pouvoir redessiner le monde (couleur pays)
    monde.features.forEach((element) => {
      let nomPays = element.properties.name;
      mapPAYS.set(nomPays, element);
    });

    // JSOSTATISTICS : 
    /*
        jsoStatistics.maxSuisseDansUnPays : Permet de calculer la couleur des points dans ce pays
        jsoStatistics.listCountry : Map("countryName", {jsonElement})
        jsoStatistics.totalSuisse : vrai valeur
        jsoStatistics.totalPointsMen : total des points (pas des vrai valeur)
        jsoStatistics.totalPointsWomen : total des points (pas des vrai valeur)
        jsoStatistics.totalPointsMenInEurope : total des points (pas des vrai valeur)
        jsoStatistics.totalPointsWomenInEurope : total des points (pas des vrai valeur)
    */
    jsoStatistics.listCountry = new Map();

    let totalPointsMenInEurope = 0;
    let totalPointsWomenInEurope = 0;
    let totalPointsMen = 0;
    let totalPointsWomen = 0;
    let totalSuisse = 0;
    let maxSuisseDansUnPays = 0;

    stats.stats.forEach((element) => {
      let country = element.country;
      let inEurope = element.inEurope;
      jsoStatistics.listCountry.set(country, element);

      // DIFFERENCE HOMMES / FEMMES
      // (Pas de visualisation)
      if (element.men > 0) {
        let nbPointMen = Math.floor((element.men / DIVISEUR) + 0.5);
        if (nbPointMen < 0) {
          nbPointMen = 1; // au-moins 1
        }
        element.nbPointMen = nbPointMen;
      } else {
        element.nbPointMen = 0;
      }

      if (element.women > 0) {
        let nbPointWomen = Math.floor((element.women / DIVISEUR) + 0.5);
        if (nbPointWomen < 0) {
          nbPointWomen = 1; // au-moins 1
        }
        element.nbPointWomen = nbPointWomen;
      } else {
        element.nbPointWomen = 0;
      }

      totalPointsMen += element.nbPointMen;
      totalPointsWomen += element.nbPointWomen;
      totalSuisse += (element.men + element.women);
      if (inEurope) {

        totalPointsMenInEurope += element.nbPointMen;
        totalPointsWomenInEurope += element.nbPointWomen;
      }
      /*
       * Pour colorier les pays.
       */
      if (element.men + element.women > maxSuisseDansUnPays) {
        maxSuisseDansUnPays = element.men + element.women;
      }
    });
    jsoStatistics.maxSuisseDansUnPays = maxSuisseDansUnPays;
    jsoStatistics.totalSuisse = totalSuisse;
    jsoStatistics.totalPointsMen = totalPointsMen;
    jsoStatistics.totalPointsWomen = totalPointsWomen;
    jsoStatistics.totalPointsMenInEurope = totalPointsMenInEurope;
    jsoStatistics.totalPointsWomenInEurope = totalPointsWomenInEurope;
    allLoaded = true;
  };


/**
*  Création des points des Suisses
*/
function creeLesSuisses() {
  let element = mapPAYS.get("Switzerland");
  element = element.geometry.coordinates[0];


  // Création de points "random" en suisse.

  ptsSUISSES.push(...getPointInside(element, jsoStatistics.totalPointsMen + jsoStatistics.totalPointsWomen));
  let idxSuisse = 0;
  jsoStatistics.listCountry.forEach(details => {
    let nbPointMen = details.nbPointMen;
    let nbPointWomen = details.nbPointWomen;
    for (i = 0; i < nbPointMen; i++) {
      let unPoint = ptsSUISSES[idxSuisse++];
      unPoint.inEurope = details.inEurope;
      unPoint.sex = "male";
    }
    for (i = 0; i < nbPointWomen; i++) {
      let unPoint = ptsSUISSES[idxSuisse++];
      unPoint.inEurope = details.inEurope;
      unPoint.sex = "female";
    }
  });

  SVG_MONDE // Dessine les points
    .selectAll() //"circle"
    .data(ptsSUISSES)
    .enter()
    .append("circle")
    .attr("class", function (d) {
      return d.inEurope ? TYPE_EUROPE : TYPE_MONDE;
    })
    .attr("cx", function (d) {
      return projection(d.coordonnee)[0];
    })
    .attr("cy", function (d) {
      return projection(d.coordonnee)[1];
    })
    .style("fill", function (d, i) {
      if (d.sex == "male") {
        return "#9ab38d";
      } else if (d.sex == "female") {
        return "#9ab38d";
      } else {
        return "black";  // Hermaphrodite ?
      }
    })
    .attr("r", 5)
    .attr("stroke-width", 1);

}


/**
*  Affichage de la carte et initialisation du mouseover pour afficher les infos.
*/
function AfficheMonde() {

  if (mondeCree) {
    return;
  }

  mondeCree = true;

  SVG_MONDE // Dessine la carte
    .selectAll() // "path"
    .data(jsoWorld.features)
    .enter()
    .append("path")

    .attr("class", "world ")
    .attr("d", d3.geoPath().projection(projection))
    .style("stroke", "#333")
    .style("stroke-width", 2)
    .style("fill", "white")
    .on("mouseover", handleMouseover)
}


function handleMouseover(e, d) {
  let nbSuisses = d.properties.nbSuisses;
  let text = d.properties.name;
  if (nbSuisses != undefined && nbSuisses > 0) {
    text += " : " + nbSuisses + " Suisses";
  }
  TOOLTIP
    .text(text);
}



/**
*  Efface le graphe
*/
function effaceGraph() {
  SVG_GRAPH.selectAll("*").remove();
}




/**
 * Migration des points de Suisse vers l'Europe / Monde.
 * @param {*} type TYPE_EUROPE ou TYPE_MONDE
 */
function emigreSuisses(type) {

  if ((type == TYPE_EUROPE && lesSuisses_Europe_enSuisse) ||
    (type == TYPE_MONDE && lesSuisses_Monde_enSuisse)) {

    let allDest = [];
    jsoStatistics.listCountry.forEach((element) => {
      if ((type == TYPE_EUROPE && element.inEurope) || (type == TYPE_MONDE && !element.inEurope)) {
        let nbPoints = element.nbPointMen + element.nbPointWomen;
        let nbSuisses = element.men + element.women; // Les vrais chiffres
        let pays = element.country;
        let points = getPointInside(getPolygon(pays), nbPoints);
        // Défini la couleur du point dans le pays.
        // plus la proportion de suisse (par rapport au max de suisse dans un pays (la france)), plus
        // le point est rouge.
        // ex, la france : nbSuisse est egal à maxSuisseDansUnPays. Donc 200 - (x * 200 / x) = 0!
        // ca fait rgb(255, 0, 0) -> Rouge pétant !
        points.forEach(unPoint => {
          unPoint.destination = pays;
          let couleur = Math.floor(200 - (nbSuisses * 200 / jsoStatistics.maxSuisseDansUnPays));
          unPoint.couleur = "rgb(220," + couleur + "," + couleur + ")";
        });
        allDest = allDest.concat(points)
      }
    });

    bougePoints(type, allDest, 2000, 5, (type == TYPE_EUROPE ? 50 : 200));
  }
}



/**
 * Fait revenir les suisses en suisse. 
 * @param {*} type TYPE_EUROPE ou TYPE_MONDE
 * @returns 
 */
function retourDesSuisses(type) {
  if (type == TYPE_EUROPE && lesSuisses_Europe_enSuisse) {
    return false; // Ils sont déjà de retour
  }
  if (type == TYPE_MONDE && lesSuisses_Monde_enSuisse) {
    return false; // Ils sont déjà de retour
  }
  let suisse = mapPAYS.get("Switzerland");
  suisse = suisse.geometry.coordinates[0];

  let p = null;
  if (type == TYPE_EUROPE) {
    p = getPointInside(suisse, jsoStatistics.totalPointsMenInEurope + jsoStatistics.totalPointsWomenInEurope);
    let idx = 0;
    // Couleur pour les hommes
    for (i = 0; i < jsoStatistics.totalPointsMenInEurope; i++) {
      p[idx++].couleur = "#9ab38d";
    }
    //couleur pour le femmes
    for (i = 0; i < jsoStatistics.totalPointsWomenInEurope; i++) {
      p[idx++].couleur = "#9ab38d";
    }
  } else {
    let totalPointMenMonde = jsoStatistics.totalPointsMen - jsoStatistics.totalPointsMenInEurope;
    let totalPointWomenMonde = jsoStatistics.totalPointsWomen - jsoStatistics.totalPointsWomenInEurope;
    p = getPointInside(suisse, totalPointMenMonde + totalPointWomenMonde);

    let idx = 0;
    // Couleur pour les hommes
    for (i = 0; i < totalPointMenMonde; i++) {
      p[idx++].couleur = "#9ab38d";
    }
    //couleur pour le femmes
    for (i = 0; i < totalPointWomenMonde; i++) {
      p[idx++].couleur = "#9ab38d";
    }

  }

  bougePoints(type, p, 2000, 5, 5, 5);

  if (type == TYPE_EUROPE) {
    lesSuisses_Europe_enSuisse = true;
  } else if (type == TYPE_MONDE) {
    lesSuisses_Monde_enSuisse = true;
  }
  return true;
}


/**
* Déplaces les points vers une destination. 
*   toutesDestinations = tableau de d'object avec les coordonnées
*   mais aussi la couleur du point de destination
* Melange des destination pour avoir un effet de déplacememnt partout
 * @param {*} type TYPE_EUROPE ou TYPE_MONDE ou TYPE_TOUS Cela correspond à la classe des éléments à selectionner
 * @param {*} toutesDestinations List de points vers lesquel on fera la transition grace à un join()
 * @param {*} duration Durée de la transition
 * @param {*} delay Délais des départs
 * @param {*} taillePoint Taille du point à l'arrivée.
 */
function bougePoints(type, toutesDestinations, duration, delay, taillePoint) {

  if (type == TYPE_EUROPE) {
    lesSuisses_Europe_enSuisse = false;
  } else if (type == TYPE_MONDE) {
    lesSuisses_Monde_enSuisse = false;
  } else if (type == TYPE_TOUS) {
    lesSuisses_Europe_enSuisse = false;
    lesSuisses_Monde_enSuisse = false;
  }
  // melange le tableau
  toutesDestinations = shuffle(toutesDestinations);

  SVG_MONDE.selectAll("." + type)
    .filter(function (d, i) {
      return i < toutesDestinations.length;
    })
    .data(toutesDestinations)
    .join()
    .transition()
    .duration(duration)
    .attr("r", taillePoint)
    .attr("cx", function (d, i) {
      let pX = projection(d.coordonnee)[0];
      return projection(d.coordonnee)[0];
    })
    .attr("cy", function (d, i) {
      let pY = projection(d.coordonnee)[1];
      return projection(d.coordonnee)[1];
    })
    .style("fill", function (d, i) {
      let couleur = d.couleur;
      console.log(couleur);
      if (couleur) {
        return couleur
      } else {
        // Valeur pas défini, utilise la couleur actuelle du point
        return d3.select(this).style("fill");
      }

    })
    .attr("stroke-width", taillePoint / 5)
    .delay(function (d, i) {
      return i * delay / 10;
    })

}


/**
 * Retourne un polygone pour un pays.
 * + met à jour le nombre de suisses qui vont dans ce pays.
 * @param {*} nomPays Nom du pays (eg "France")
 * @returns Le polygone correspondant à ce pays
 */
function getPolygon(nomPays) {
  let element = mapPAYS.get(nomPays);
  let stats = jsoStatistics.listCountry.get(nomPays);
  element.properties.nbSuisses = stats.men + stats.women;
  // Si le type est un multiPolygon, on ne considère que le 
  // plus grand pays (celui qui a le plus de vecteur)
  // Si-non, nos suisses vont se retrouver tous en corse si on veut les faire aller
  // en France :-(
  let type = element.geometry.type;
  let polyPays = element.geometry.coordinates;
  if (type == "MultiPolygon") {
    let principal = element.geometry.main;
    polyPays = polyPays[principal][0];
  } else {
    polyPays = polyPays[0];
  }
  return polyPays;
}

//////////////////////////////////////////////////////////////////
// CHIFFRE 

/**
 * Crée des polygones avec les chiffres passé, et bouge les point en dedans.
 * Ajoute 2 points spéciaux pour la fin.
 * @param {*} nombre Le Chiffre à montrer
 * @returns 
 */
function montreChiffre(nombre) {

  const aNombre = Array.from(nombre.toString());
  const suissesParChiffre = ptsSUISSES.length / aNombre.length;
  let allDest = []
  let dX = aNombre.length / 2 * -50;
  aNombre.forEach((unChiffre) => {
    const polyChiffre = mapCHIFFRES.get(unChiffre);
    const newPoly = [];
    polyChiffre.forEach((coordonee) => {
      newPoly.push([coordonee[0] + dX, coordonee[1]]);
    }); // Bouge a droite
    allDest = allDest.concat(getPointInside(newPoly, suissesParChiffre));
    dX += 50;
  });


  bougePoints(TYPE_TOUS, allDest, 4000, 1, 200, null);

  let salutation = {};
  salutation.isSalutation = true;
  /*
  * Créé des points suplémentaire ... Il faut qu'il soit sur les autre !!!!!
  */

  SVG_MONDE // Dessine les points
    .data([salutation])
    .append("circle")
    .transition()
    .duration(4000)
    .attr("class", ".salutations")
    .attr("cx", function (d) { return projection(allDest[0].coordonnee)[0]; })
    .attr("cy", function (d) { return projection(allDest[0].coordonnee)[1]; })
    .style("fill", "black")
    .attr("r", 300)

  SVG_MONDE // Dessine le texte
    .data([salutation])
    .append("text")
    .transition()
    .duration(4000)
    .attr("class", ".salutations")
    .attr("x", function (d) { return projection(allDest[0].coordonnee)[0] - 220; })
    .attr("y", function (d) { return projection(allDest[0].coordonnee)[1] - 80; })
    .style("fill", "white")
    .style("font-size", "50px")
    .text("Ferida Papracanin")
  SVG_MONDE
    .data([salutation])
    .append("text")
    .transition()
    .duration(4000)
    .attr("class", ".salutations")
    .attr("x", function (d) { return projection(allDest[0].coordonnee)[0] - 180; })
    .attr("y", function (d) { return projection(allDest[0].coordonnee)[1] + 80; })
    .style("fill", "white")
    .style("font-size", "50px")
    .text("Sophie Aubert");

  /* **************************************************
  *   MERCI 
  */

  SVG_MONDE // Dessine les points
    .data([salutation])
    .append("circle")
    .transition()
    .duration(4000)
    .attr("class", ".salutations")
    .attr("cx", function (d) { return projection(allDest[1].coordonnee)[0]; })
    .attr("cy", function (d) { return projection(allDest[1].coordonnee)[1]; })
    .style("fill", "black")
    .attr("r", 300)

  SVG_MONDE // Dessine le texte
    .data([salutation])
    .append("text")
    .transition()
    .duration(4000)
    .attr("class", ".salutations")
    .attr("x", function (d) { return projection(allDest[1].coordonnee)[0] - 240; })
    .attr("y", function (d) { return projection(allDest[1].coordonnee)[1] + 40; })
    .style("fill", "white")
    .style("font-size", "150px")
    .text("Merci !")


  let x = [projection(allDest[0].coordonnee), projection(allDest[1].coordonnee)];
  return x;

}


/**
 * Détruits les points spéciaux salutations. Ils on une propriété isSalutation (voir montreChiffre()).
 */
function enleveSalutations() {
  SVG_MONDE.selectAll("circle")
    .filter(function (d, i) {
      if (d.isSalutation) {
        return true;
      }
      return false;
    })
    .remove();

  SVG_MONDE.selectAll("text")
    .filter(function (d, i) {
      if (d.isSalutation) {
        return true;
      }
      return false;
    })
    .remove();

}

//////////////////////////////////////////////////////////////////
// GRAPHE


/**
 * Affichage du graphe
 */
function afficheGraph() {
  // Données
  const dataset = [
    { year: 2011, value: 29756 },
    { year: 2012, value: 30026 },
    { year: 2013, value: 28489 },
    { year: 2014, value: 28496 },
    { year: 2015, value: 30103 },
    { year: 2016, value: 30565 },
    { year: 2017, value: 31840 },
    { year: 2018, value: 31794 },
    { year: 2019, value: 31362 },
    { year: 2020, value: 25774 },
    { year: 2021, value: 28716 },
  ];

  // Dimensions du SVG et des barres
  const width = 1200;
  const height = 800;
  const margin = { top: 100, right: 20, bottom: 50, left: 140 };

  // Création de l'échelle X
  const xScale = d3
    .scaleBand()
    .domain(dataset.map((d) => d.year))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  // Création de l'échelle Y
  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(dataset, (d) => d.value)])
    .range([height - margin.bottom, margin.top]);

  // Création de l'axe X
  const xAxis = (g) =>
    g
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickSizeOuter(0))
      .call((g) => g.select(".domain").remove())
      .append("line")
      .attr("x1", xScale.range()[0]) // Début de la ligne
      .attr("y1", 0)
      .attr("x2", xScale.range()[1]) // Fin de la ligne
      .attr("y2", 0)
      .attr("stroke", "black") // définit la couleur de la ligne en gris clair
      .attr("stroke-width", 5); // définit la couleur de la ligne en gris clair

  // Création de l'axe Y
  const yAxis = (g) =>
    g
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(null, "s"))
      .call((g) => g.select(".domain").remove())
      // .attr("x", 60) // déplace le texte de la légende de l'axe Y vers la gauche
      .append("line") // ajoute un élément line
      .attr("x1", 0) // définit la position x de l'extrémité de départ de la ligne
      .attr("y1", yScale.range()[0]) // définit la position y de l'extrémité de départ de la ligne
      .attr("x2", 0) // définit la position x de l'extrémité d'arrivée de la ligne
      .attr("y2", yScale.range()[1]) // définit la position y de l'extrémité d'arrivée de la ligne
      .attr("stroke", "black") // définit la couleur de la ligne en gris clair
      .attr("stroke-width", 5); // définit la couleur de la ligne en gris clair

  // Ajout de l'axe
  SVG_GRAPH.append("g").call(xAxis);

  // Ajout de la légende de l'axe Y
  SVG_GRAPH
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", margin.left / 2)
    .text("Nombre d'expatriés")
    .style("text-anchor", "middle")
    .style("font-size", "40px");

  // Ajout de l'axe Y
  SVG_GRAPH.append("g").call(yAxis);

  // Cree des rectangles (polygone) et les rempli avec les suisses ...
  let allBars = [];
  let X = 6.9; // Must be 6.72 !!
  let Y = 46.21;
  let dX = 0.08;
  const RATIO = 1.07 / 30026;
  dataset.forEach((oneYear) => {
    let dY = oneYear.value * RATIO;
    let bar = [];
    bar.push([X, Y]);
    bar.push([X + dX, Y]);
    bar.push([X + dX, Y + dY]);
    bar.push([X, Y + dY]);
    let pts = getPointInside(bar, ptsSUISSES.length / dataset.length);
    allBars = allBars.concat(pts);
    X += 0.2368;
  });


  // Mélange les hommes et les femmes avant de leur attribuer une couleur !
  allBars = shuffle(allBars);

  let idx = 0;
  for (i = 0; i < jsoStatistics.totalPointsMen; i++) {
    allBars[idx++].couleur = "#9ab38d";
  }
  for (i = 0; i < jsoStatistics.totalPointsWomen; i++) {
    allBars[idx++].couleur = "#9ab38d";
  }
  do {
    allBars[idx++].couleur = "#a60d45";
  } while (idx < allBars.length);


  bougePoints(TYPE_TOUS, allBars, 2000, 2, 2);

  lesSuisses_Europe_enSuisse = true;
  lesSuisses_Monde_enSuisse = true;
}


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
    loadData();
    handleResize();
        scroller
            .setup({
                step: "#scrolly article .step",
                offset: 0.33,
                debug: false
            })
            .onStepEnter(handleStepEnter);
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