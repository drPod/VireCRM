# Microsoft Graph — context7 reference chunks

Source library: `/microsoftgraph/microsoft-graph-docs-contrib`
Query: `mail read send subscriptions webhooks calendars events attachments upload session auth code PKCE refresh token offline_access throttle scopes permissions`
Snapshot date: 2026-05-22
Regenerate via: `mcp__context7__query-docs` (see `scripts/sync-microsoft-graph-docs.sh` TODO).

---

### Create an upload session for an event attachment in Python

Source: https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/includes/snippets/python/v1/walkthrough-create-uploadsession-event-python-snippets.md

Use this snippet to create an upload session for a file attachment to a specific event. Ensure you have initialized the GraphServiceClient and have the event ID. The attachment item requires a name, size, and type.

```python
# Code snippets are only available for the latest version. Current version is 1.x
from msgraph import GraphServiceClient
from msgraph.generated.users.item.events.item.attachments.create_upload_session.create_upload_session_post_request_body import CreateUploadSessionPostRequestBody
from msgraph.generated.models.attachment_item import AttachmentItem
from msgraph.generated.models.attachment_type import AttachmentType
# To initialize your graph_client, see https://learn.microsoft.com/en-us/graph/sdks/create-client?from=snippets&tabs=python
request_body = CreateUploadSessionPostRequestBody(
	attachment_item = AttachmentItem(
		attachment_type = AttachmentType.File,
		name = "flower",
		size = 3483322,
	),
)

result = await graph_client.me.events.by_event_id('event-id').attachments.create_upload_session.post(request_body)
```

---

### Create Upload Session for Message Attachment

Source: https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/includes/snippets/python/v1/walkthrough-create-uploadsession-message-python-snippets.md

This snippet demonstrates how to create an upload session for a message attachment. It initializes the necessary objects, sets attachment details, and calls the `create_upload_session` method.

```APIDOC
## Create Upload Session for Message Attachment

### Description
Initiates an upload session for a message attachment, allowing for large file uploads.

### Method
POST

### Endpoint
/me/messages/{message-id}/attachments/createUploadSession

### Parameters
#### Path Parameters
- **message-id** (string) - Required - The ID of the message to which the attachment will be added.

#### Request Body
- **attachmentItem** (AttachmentItem) - Required - An object containing details about the attachment.
  - **attachmentType** (AttachmentType) - Required - The type of attachment (e.g., File).
  - **name** (string) - Required - The name of the attachment file.
  - **size** (integer) - Required - The size of the attachment file in bytes.

### Request Example
```python
from msgraph import GraphServiceClient
from msgraph.generated.users.item.messages.item.attachments.create_upload_session.create_upload_session_post_request_body import CreateUploadSessionPostRequestBody
from msgraph.generated.models.attachment_item import AttachmentItem
from msgraph.generated.models.attachment_type import AttachmentType

# Assuming graph_client is already initialized
request_body = CreateUploadSessionPostRequestBody(
    attachment_item = AttachmentItem(
        attachment_type = AttachmentType.File,
        name = "flower",
        size = 3483322,
    ),
)

result = await graph_client.me.messages.by_message_id('message-id').attachments.create_upload_session.post(request_body)
```

### Response
#### Success Response (200)
- **uploadUrl** (string) - The URL to which the attachment content should be uploaded.
- **uploadSessionUrl** (string) - The URL for the upload session.

#### Response Example
```json
{
  "@odata.type": "#microsoft.graph.uploadSession",
  "uploadUrl": "https://graph.microsoft.com/v1.0/users/some_user_id/messages/some_message_id/attachments/some_attachment_id/uploadContent",
  "expirationDateTime": "2024-01-01T12:00:00Z",
  "nextExpectedRanges": [
    "0-3483321"
  ]
}
```
```

---

### Create Upload Session for Event Attachment (Java)

Source: https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/includes/snippets/java/v1/walkthrough-create-uploadsession-event-java-snippets.md

This Java snippet demonstrates how to initiate an upload session for a file attachment to a specific event in Microsoft Graph. It sets up the necessary request body with attachment details like type, name, and size, and then sends the request to create the upload session.

```APIDOC
## Create Upload Session for Event Attachment

### Description
Initiates an upload session for a file attachment to a specific event.

### Method
POST

### Endpoint
/me/events/{event-id}/attachments/createUploadSession

### Request Body
- **attachmentItem** (AttachmentItem) - Required - Details of the attachment to be uploaded.
  - **attachmentType** (AttachmentType) - Required - The type of attachment (e.g., File).
  - **name** (string) - Required - The name of the attachment file.
  - **size** (long) - Required - The size of the attachment file in bytes.

### Request Example
```java
GraphServiceClient graphClient = new GraphServiceClient(requestAdapter);

com.microsoft.graph.users.item.events.item.attachments.createuploadsession.CreateUploadSessionPostRequestBody createUploadSessionPostRequestBody = new com.microsoft.graph.users.item.events.item.attachments.createuploadsession.CreateUploadSessionPostRequestBody();
AttachmentItem attachmentItem = new AttachmentItem();
attachmentItem.setAttachmentType(AttachmentType.File);
attachmentItem.setName("flower");
attachmentItem.setSize(3483322L);
createUploadSessionPostRequestBody.setAttachmentItem(attachmentItem);

var result = graphClient.me().events().byEventId("{event-id}").attachments().createUploadSession().post(createUploadSessionPostRequestBody);
```

### Response
#### Success Response (200)
- **uploadUrl** (string) - The URL to use for uploading the file content.
- **expirationDateTime** (DateTimeTimeZone) - The date and time when the upload session expires.
- **nextExpectedRanges** (array of strings) - Indicates the byte ranges that are expected for the next chunk of the upload.
```

---

### Create upload session for event attachments (C#)

Source: https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/includes/snippets/csharp/v1/walkthrough-create-uploadsession-event-csharp-snippets.md

This snippet shows how to create an upload session for an attachment to a specific event. You need to provide the event ID and details about the attachment, such as its name, size, and type.

```APIDOC
## Create upload session for event attachments

### Description
Creates an upload session for an attachment to a specific event.

### Method
POST

### Endpoint
/me/events/{event-id}/attachments/createUploadSession

### Request Body
- **attachmentItem** (AttachmentItem) - Required - Details about the attachment.
  - **attachmentType** (AttachmentType) - Required - The type of attachment (e.g., File).
  - **name** (string) - Required - The name of the attachment.
  - **size** (long) - Required - The size of the attachment in bytes.

### Request Example
```csharp
var requestBody = new CreateUploadSessionPostRequestBody
{
    AttachmentItem = new AttachmentItem
    {
        AttachmentType = AttachmentType.File,
        Name = "flower",
        Size = 3483322L,
    },
};

// To initialize your graphClient, see https://learn.microsoft.com/en-us/graph/sdks/create-client?from=snippets&tabs=csharp
var result = await graphClient.Me.Events["{event-id}"].Attachments.CreateUploadSession.PostAsync(requestBody);
```

### Response
#### Success Response (200)
- **uploadUrl** (string) - The URL to upload the attachment content.
- **expirationDateTime** (DateTimeTimeZone) - The date and time when the upload session expires.
- **nextExpectedRanges** (string[]) - The ranges of bytes that are expected next for the upload.
```

---

### Create an upload session for an event (HTTP — concepts/outlook-large-attachments.md)

Source: https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/concepts/outlook-large-attachments.md

This snippet demonstrates how to initiate an upload session for attaching a large file to an event.

```APIDOC
## POST /me/events/{event-id}/attachments/createUploadSession

### Description
Creates an upload session to enable uploading large attachments to an event.

### Method
POST

### Endpoint
/me/events/{event-id}/attachments/createUploadSession

### Request Body
- **AttachmentItem** (object) - Required - Contains details about the attachment.
  - **attachmentType** (string) - Required - Type of attachment (e.g., 'file').
  - **name** (string) - Required - Name of the attachment.
  - **size** (integer) - Required - Size of the attachment in bytes.

### Request Example
```http
POST https://graph.microsoft.com/v1.0/me/events/AAMkADU5CCmSAAA=/attachments/createUploadSession
Content-type: application/json

{
  "AttachmentItem": {
    "attachmentType": "file",
    "name": "flower",
    "size": 3483322
  }
}
```

### Response
#### Success Response (201 Created)
- **@odata.context** (string) - Metadata context.
- **uploadUrl** (string) - The URL to use for uploading the file content.
- **expirationDateTime** (string) - The date and time when the upload session expires.
- **nextExpectedRanges** (array) - An array of integers representing the byte ranges expected next.

#### Response Example
```json
{
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#microsoft.graph.uploadSession",
    "uploadUrl": "https://outlook.office.com/api/v2.0/Users('d3b9214b-dd8b-441d-b7dc-c446c9fa0e69@98a79ebe-74bf-4e07-a017-7b410848cb32')/Events('AAMkADU5CCmSAAA=')/AttachmentSessions('AAMkADU5RpAACJlCs8AAA=')?authtoken=eyJhbGciOiJSUzI1NiIsImtpZCI6IktmYUNIBtw",
    "expirationDateTime": "2020-02-22T02:46:56.7410786Z",
    "nextExpectedRanges": [
        "0-"
    ]
}
```
```
