### Docs Task States

Interactive teaching component for the [Async State](../async.html#model-async-work-as-a-task) guide. One `Task` fetches a simulated release feed on a request token. Refetch and failure controls walk `match()` routing through `nil`, `ok`, `stale`, and `err` — every log line is a real state transition of the task.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/docs-task-states.html" /%}
{% /demo %}

#### Tag Name

`docs-task-states`

#### Reactive Properties

None. The fetch button and fail toggle drive the task's request token internally.
