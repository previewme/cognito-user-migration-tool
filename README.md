# cognito-user-migration-tool

Lambda function which automatically migrates a user from the current user pool to a new user pool when the user tries to
log in or tries to replace their password

## Configuration

### Environment variables

| Environment Variable | Description | Required |
| --- | --- | --- |
| SOURCE_CLIENT_ID | The ID of the source user's client id for authentication | Yes |
| SOURCE_USER_POOL_ID | The ID of the source user's user pool | Yes |
| ROLE_TO_ASSUME_ARN | Name of the role to assume to access the current user | Yes |
| ROLE_SESSION_NAME | Name of the role session | Yes |
| SOURCE_REGION | Current AWS region of the source user pool | Yes |
| ATTRIBUTES_TO_MIGRATE | Attributes that need to be transferred | No |

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
