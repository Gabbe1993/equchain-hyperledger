#How to run:

--To redeploy network running network first shutdown docker containers with 
./teardownAllDocker.sh

- Always inside network:
    - sh getBin.sh (create platform-specific binaries)
    - sh deploy_network.sh(beautiful print should show that bynf execution completed)
    - sh deploy_composer.sh (on a separate terminal)
      
- After modifying business-network files in emission-network folder:
    - composer archive create -t dir -n . (move .bna file to the multiorg directory)

The final product, is two business network cards X and Y, the administrator of Org1 and Org 2 respectively. Each organization has 2 peers. To run a second server with Y on a different port:

composer-rest-server -c Y@emission-network -n "never" -p 3001

The Network Admin card is a card that provides access to the deployed business network. The default is that the credentials you supply either by -A/-S or -A/-C when you deploy or start a business network is then bound to in instance of the inbuilt NetworkAdmin Participant type with a name usually the same as that specified in the -A part. To access a business network you have to use an identity that is mapped to a participant.

- Other commands
yo hyperledger-composer:angular
cd angular-app && npm start (or yarn install)
docker logs peer0.org1.example.com
**currently exploring blockchain explorer**
docker exec -it peer0.org1.example.com sh -c "peer channel --help"

- To run the explorer
    - install mysql
    - edit config.json accordingly
    - npm install
    - sh start.sh
    - http://localhost:8080
    mysql -uroot -p < db/fabricexplorer.sql

- ps, ps pid 8549
