### Health Check App

Expose application health checks as prometheus endpoint.

Create the below config map.

`
kubectl create configmap app-config --from-file=app-config.json
`