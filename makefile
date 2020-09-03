up:
	docker-compose up -d
down:
	docker-compose down
list:
	docker-compose ps
stop:
	docker-compose stop

check-install-deps:
	node check-install-dependencies.js

start_server: check-install-deps
	node ./bin/www