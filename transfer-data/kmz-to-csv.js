const fs = require('fs'),
    path = require('path'),
    xmlReader = require('read-xml');
const convert = require('xml-js');
const geocoder = require('local-reverse-geocoder');

const dataFile = path.join('data', './doc.kml');
const stream = fs.createWriteStream("build/team-map.csv", {flags:'a'});
stream.write('timestamp|club name|latitude|longitude|Any other info - free text|club logo|city|country\n');


geocoder.init({}, function() {

xmlReader.readXML(fs.readFileSync(dataFile), function(err, data) {
    if (err) {
        console.error(err);
        return;
    }

    var xml = data.content;
    var jsonData = JSON.parse(convert.xml2json(xml, {compact: true, spaces: 4}));
    console.log(`Process ${jsonData.kml.Document.Folder[0].Placemark.length} teams`);

    const styles = jsonData.kml.Document.Style;
    let timestamp = '01/01/2017 00:00:00';
    

    for (let i = 0; i < jsonData.kml.Document.Folder[0].Placemark.length; i++) {
        const entry = jsonData.kml.Document.Folder[0].Placemark[i];
        try {
            const coordinates = entry.Point.coordinates._text.trim().split(",");

            const converted = {
                name: (entry.name._text || entry.name._cdata).trim(),
                latitude: coordinates[coordinates.length - 2] || 0,
                longitude: coordinates[coordinates.length - 3] || 0,
                description: entry.description && (entry.description._text || entry.description._cdata).trim() || '',
                logo: '',
            }

            // Image refer to StyleMap entry, we need to postfix '-normal' to get the style id and therefore the path
            const image = entry.styleUrl._text;
            if (image) {
                const styleId = `${image.trim().replace('#', '')}-normal`;
                const imageStyle = styles.find((style) => style._attributes.id === styleId);
                converted.logo = `http://hithredin.eu/img/buhurt-map/${imageStyle.IconStyle.Icon.href._text.trim()}`;
            }
            
            // Save into CSV data output
            geocoder.lookUp(converted, function(errGeocode, geocodes) {
                if (geocodes.length && geocodes[0].length) {
                    converted.city = geocodes[0][0].asciiName;
                    converted.country = geocodes[0][0].countryCode;
                } else {
                    converted.city = '';
                    converted.country = ''; 
                }
                stream.write(Object.values(converted).reduce((memo, value) => `${memo}|${value}`, timestamp) + "\n");
            });
        }
        catch (dataError) {
            console.error(`error on data ${JSON.stringify(entry)}: ${dataError}`);
        }
    }

    stream.end();
});
});