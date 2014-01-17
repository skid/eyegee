# EyeGee - iGoogle replacement

This is a small stand-alone node.js application that will replace iGoogle.
As much as possible and as much as I have time to work on it.


## Development Setup

For Eyegee to run you will need to install Node.js and Redis.  
You will also need Git for development work.  

You can get get Node.js from [http://nodejs.org](http://nodejs.org)  
You can get Redis from [http://redis.io/download](http://redis.io/download)  
And Git from [http://git-scm.com/downloads](http://git-scm.com/downloads)  


Clone the repository from github:

    git clone git@github.com:skid/eyegee.git

Go to the cloned directoy and install dependencies:

    cd eyegee
    npm install

Make sure the Redis server is running and then start the development server:

    node server.js

