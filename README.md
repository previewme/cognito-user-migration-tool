# cognito-user-migration-tool 

Lambda function which automatically migrates a user from the current user pool to a new user pool when the user tries to log in or tries to replace their password


## Configuration

### Environment variables

| Environment Variable | Description | Required |
| --- | --- | --- |
| OLD_USER_POOL_ID | ID of the user's current user pool | Yes |
| OLD_AWS_ACCOUNT_ID | ID of the user's current aws account | Yes |
| OLD_ASSUME_ROLE_NAME | Name of the role to assume to access the current user | Yes |
| OLD_REGION | Region of the user's current aws account | Yes |
| NEW_REGION | Region of the user's new aws account | Yes |

## Build

To build the lambda function run the following.

```
npm install
npm run build
```

## Test

To run the tests.

```
npm test
```

## Package

The following will package the lambda function into a zip bundle to allow manual deployment.

```
zip -q -r dist/lambda.zip node_modules dist
```