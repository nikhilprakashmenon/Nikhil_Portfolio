
//Initializations
var express = require("express");
//npm install body-parser --save
var bodyParser = require("body-parser");
var pg = require("pg");
var app = express();
var connString = "postgres://postgres:root@123@localhost:5432/portfolio";


//Configurations
app.set("port",(process.env.PORT||5000));
app.use(express.static(__dirname + "/public"));
//Parses POST requests. The Content-type in the HTTP request header is set to application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({type:"application/x-www-form-urlencoded"}));


//Route handlers
app.post("/contact.html", function(request, response) {

	console.log("Inside post handler");
	var requestParam = {
		name : request.body.fullname,
		email : request.body.email,
		subject : request.body.subject,
		message: request.body.message || null,
	};

	for(var prop in requestParam)
		console.log(requestParam + " : " + requestParam[prop]);

	var statusObj = persist(response, requestParam, "contact_info");
	console.log("Going to send response: " + statusObj);


	if(!statusObj){
		console.log("Successfully saved to database");
		response.sendFile(__dirname + "/public/contact.html");
	}
	else
		console.log("Failure saving to database");
		
});


function persist(response, requestParam, table){

	console.log("Inside persist function");
	pg.connect(process.env.DATABASE_URL || connString, function(err, client, done){

		// Handling connection errors
		if(err){
			done();
			console.log("Error getting connection: " + err);
			// return {status:500, error:true, errMessage: err};
			return false;
		}

 		var query, argList;

 		if(table == "contact_info"){
 			query = "INSERT INTO public.contact_info(name,email,subject,message) values ($1, $2, $3, $4)";
 			argList = [];
 			for(var prop in requestParam)
 				argList.push(requestParam[prop]);
 		}

		client.query(query, argList ,function(err, result){
			if(err){
				done();
				console.log("Error in query: " + err);
				// return {status:500, error:true, errMessage: err};
				return false;
			}
			else{
				console.log("success storing to database");
				// return {status:200, error:false, errMessage: null};
				return true;
			}
		});
	});
}

//Listening to port for requests
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
