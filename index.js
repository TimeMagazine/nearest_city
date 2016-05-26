// See http://gis.stackexchange.com/questions/88811/how-to-find-nearest-city-using-geonames-features-codes

var fs = require("fs"),
	csv = require("fast-csv"),
	quadtree = require("quadtree"),
	distance = require("geodist");

var cities = [];
var quads = {};
var PRECISION = 6;

//module.exports = {};

module.exports.initialize = function(callback) {
	var headers = [ "geonameid", "name", "asciiname", "alternatenames", "latitude", "longitude", "feature class", "feature code", "country code", "cc2", "admin1 code", "admin2 code", "admin3 code", "admin4 code", "population", "elevation", "dem", "timezone", "modification date" ];
	//var banned = ["PPLA3", "PPLA4", "PPLX", "PPL"];

	var stream = fs.createReadStream(__dirname + "/cities5000.txt");
	csv
		.fromStream(stream, { headers : headers, delimiter: "\t", quote: null })
		.on("data", function(city) {
			city.latitude = parseFloat(city.latitude);
			city.longitude = parseFloat(city.longitude);
			city.population = parseInt(city.population);
			delete city.alternatenames;
			cities.push(city);
		})
		.on("end", function() {
			console.log("Loaded cities, now building quadtree");
			makeQuadtree();
		});

	function makeQuadtree() {
		cities.forEach(function(city) {
			var q = quadtree.encode({ lng: city.longitude, lat: city.latitude }, PRECISION);
			quads[q] = quads[q] || [];
			quads[q].push(city);
		});

		for (var q in quads) {
			//console.log(quads[q].length + " cities in " + q);
		}
		callback();
	}
}

module.exports.locate = function(point) {
	point.longitude = parseFloat(point.lng || point.longitude);
	point.latitude = parseFloat(point.lat || point.latitude);

	//console.log(point);

	var q = quadtree.encode({ lng: point.longitude, lat: point.latitude }, PRECISION),
		candidates = [],
		min = Infinity,
		nearest;

	// add the surrounding quadrants if they exist
	for (var n = -1; n <= 1; n += 1) {
		for (var w = -1; w <= 1; w += 1) {
			var neighborkey = quadtree.neighbour(q, n, w);
			if (quads[neighborkey]) {
				candidates = candidates.concat(quads[neighborkey]);
			}
		}
	}

	if (!candidates.length) {
		console.log("Couldn't locate a city near ", point);
		return null;
	}

	candidates.forEach(function(neighbor) {
		var dist = distance({ lat: point.latitude, lng: point.longitude }, { lat: neighbor.latitude, lng: neighbor.longitude }, { unit: "mi", exact: true } );
		//console.log(neighbor.name, neighbor.latitude, neighbor.longitude, dist);

		// won't allow 0 in case the point inself is in here
		if (dist < min && dist !== 0) {
			min = dist;
			nearest = neighbor;
		}
	});

	if (!nearest) {
		console.log("Couldn't locate a city near ", point);
		return null;
	}

	//console.log(nearest)

	return {
		nearest: nearest,
		distance: min,
		quadtree: q,
		log: "Checked " + candidates.length + " neighbors in quadrant " + q
	};
}