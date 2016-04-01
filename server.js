
//Initializations
var express = require("express");
//npm install body-parser --save
var bodyParser = require("body-parser");
// npm install js-sha256 --save
var sha256 = require('js-sha256');
// npm install csprng --save
var rand = require('csprng');
// npm install pg --save
var pg = require("pg");

var app = express();
var connString = "postgres://postgres:root@123@localhost:5432/portfolio";


//Configurations
app.set("port",(process.env.PORT||5000));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + "/public"));
var sha256Ex = require(__dirname +"/public/assets/javascript/sha256hash");



//Parses POST requests. The Content-type in the HTTP request header is set to application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({type:"application/x-www-form-urlencoded"}));

//Route handlers - contact.html
app.post("/contact.html", function(request, response) {

	var requestParam = {
		name : request.body.fullname,
		email : request.body.email,
		subject : request.body.subject,
		message: request.body.message || null,
	};

	for(var prop in requestParam)
		console.log(requestParam + " : " + requestParam[prop]);

	// Save data to database
	persist(response, requestParam, "contact_info");
		
});

//Route handlers - admin.html
app.post("/admin.html", function(request, response) {

	var requestParam = {
		mobile : request.body.mobile,
		password : request.body.adminpass,
	};

	// authenticate user
	userAuthenticate(requestParam, response);
});


// function to authenticate user
function userAuthenticate(requestParam, response){

	var res, results = [];

	function renderAdminPage(){
		console.log("Inside render admin page");
		  pg.connect(process.env.DATABASE_URL || connString, function(err, client, done) {
		    client.query('SELECT * FROM public.contact_info;', function(err, result) {
		      done();
		      if (err)
		       { return console.error(err); response.send("Error " + err); }
		      else
		       { return response.render('adminPage', {results: result.rows} ); }
		    });
		  });
	}


	function userCheck(arg){

		if(arg["mobile"] == requestParam["mobile"]){

			// Password to check - sha256(salt + sha256(password)) is cross checked against existing password
			var passCheck = sha256(arg["salt"] + requestParam.password);

			if(passCheck == arg["hash_pwd"]){
				return renderAdminPage();				
			}
			else{				
				return response.render('errorPage', {status: 401, error: "Invalid user name or password!"} ); 
			}
		}
		else{	
			return response.render('errorPage', {status: 401, error: "Invalid user name or password!"}); 
		}

	}

	pg.connect(process.env.DATABASE_URL || connString, function(err, client, done){

		// Handling connection errors
		if(err){
			done();
			console.log("Error getting connection: " + err);
			return response.render('errorPage', {status: 500, error: "Internal Server Error...We will get back to you.."} ); 
		}

 		var selectQuery = 'SELECT mobile, name, hash_pwd, salt FROM public.user_account WHERE mobile = \'' + String(requestParam.mobile) + '\';';


		var query = client.query(selectQuery, function(err){
			if(err){
				done();
				console.log("Error in query: " + err);
				return response.render('errorPage', {status: 500, error: "Internal Server Error...We will get back to you.."} ); 
			}
		});

		query.on('row', function(row, result) {				
       		results.push(row);
    	});

    	query.on('end', function() {
            done();
			
            if(results.length == 1){        
            	res = results[0];            	
            	return userCheck(res);
            }
            else{
            	console.log("Error: Fetched more than one row");
            	return response.render('errorPage', {status: 500, error: "Internal Server Error...We will get back to you.."} ); 
            }	
        });
 		
	});
}

// Function to save data
function persist(response, requestParam, table){

	console.log("Inside persist function");
	pg.connect(process.env.DATABASE_URL || connString, function(err, client, done){

		// Handling connection errors
		if(err){
			done();
			console.log("Error getting connection: " + err);
			return response.render('errorPage', {status: 500, error: "Internal Server Error...We will get back to you.."} ); 
		}

 		var query, argList;

 		if(table == "contact_info"){
 			query = "INSERT INTO public.contact_info(name,email,subject,message) values ($1, $2, $3, $4)";
 			argList = [];
 			for(var prop in requestParam)
 				argList.push(requestParam[prop]);
 		}

		client.query(query, argList ,function(err, result){
			done();
			if(err){
				console.log("Error in query: " + err);
				return response.render('errorPage', {status: 500, error: "Internal Server Error...We will get back to you.."} ); 
			}
			else{
				console.log("success storing to database");
				return response.sendFile(__dirname + "/public/contact.html");
			}
		});
	});
}

//Listening to port for requests
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
