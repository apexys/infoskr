const http = require('http');
const url = require('url');
const fs = require('fs');
const EventEmitter = require('events');

var eventproxy = new class extends EventEmitter{}();

let routes = {};

const server = http.createServer((req, res) => {
    try{
        let urlparts = url.parse(req.url, true);
        let path = urlparts.pathname.trim();
        console.log("request: " + path);
        if(!routes[path]){
            res.writeHead(400, { 'Content-Type': 'text/plain'});
            res.write("There is no function registered under this path");
            res.end();
        }else{
            routes[path](req,res);
        }

    }catch(e){
        res.writeHead(500, { 'Content-Type': 'text/plain'});
        res.write(e.message);
        res.end();
    }
});

server.listen(8123);


routes['/'] = (req,res) => {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(fs.readFileSync('ssetest.html'));
    res.end();
}

routes['/eventstream'] = (req,res) => {
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*'});
    eventproxy.on('update', m => {
        res.write('event: update\n');
        res.write(`data: ${m}\n\n`);
    });
}


setInterval(()=>{
    console.log("EVENT!");
    eventproxy.emit('update', `Event emitted at ${new Date().toString()}`);
}, 1000);