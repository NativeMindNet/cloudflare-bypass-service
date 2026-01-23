#sudo docker stop f8367bc6e2c9

#sudo docker run -d --network="host" \
#-e PORT=3000 \
#-e browserLimit=20 \
#-e timeOut=120000 \
#zfcsoftware/cf-clearance-scraper:latest

sudo docker run -d -p 3001:3000  \
-e PORT=3000 \
-e browserLimit=20 \
-e timeOut=120000 \
zfcsoftware/cf-clearance-scraper:latest