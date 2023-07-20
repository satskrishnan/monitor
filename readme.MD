### Health Check App

Expose finacle application health checks as prometheus endpoint.

Create the below config map.

`
kubectl create configmap app-config --from-file=app-config.json
`