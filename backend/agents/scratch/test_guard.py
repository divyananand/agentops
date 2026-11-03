from guardrails import validate_tool_call

# test 1: everything valid
# expect: an empty list [] because there is nothing wrong
print("test 1:", validate_tool_call("create_task", {"title": "ok task", "priority": "high"}))

# test 2: priority is not in the allowed list
# expect: a problem saying priority must be one of low/medium/high
print("test 2:", validate_tool_call("create_task", {"title": "x", "priority": "urgent"}))

# test 3: the required title is missing
# expect: a problem saying title is missing
print("test 3:", validate_tool_call("create_task", {"priority": "low"}))

# test 4: task_id should be a number but it's text
# expect: a problem saying task_id must be an integer
print("test 4:", validate_tool_call("update_task", {"task_id": "five"}))

# test 5: a field that doesn't exist in the schema
# expect: a problem saying unknown field
print("test 5:", validate_tool_call("create_task", {"title": "x", "assignee": "Sam"}))