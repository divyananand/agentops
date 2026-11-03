from tools import TOOLS


def validate_tool_call(name, tool_input):
    # returns a list of problems. empty list means the call is fine

    # find this tool's schema in the TOOLS menu
    schema = None
    for tool in TOOLS:
        if tool["name"] == name:
            schema = tool["input_schema"]
    if schema is None:
        return ["unknown tool: " + name]

    problems = []
    properties = schema["properties"]

    # check 1: every required field must be there (this is the missing title case)
    for field in schema["required"]:
        if field not in tool_input:
            problems.append("missing required field: " + field)

    for field in tool_input:
        # check 2: claude can't invent fields the schema doesn't have
        if field not in properties:
            problems.append("unknown field: " + field)
            continue

        rules = properties[field]

        # check 3: the value must be in the enum list (this is the 'urgent' case)
        if "enum" in rules and tool_input[field] not in rules["enum"]:
            problems.append("{} must be one of {}, got '{}'".format(field, rules["enum"], tool_input[field]))

        # check 4: type check (integer fields must be ints, string fields strings)
        if rules.get("type") == "integer" and not isinstance(tool_input[field], int):
            problems.append(field + " must be an integer")
        if rules.get("type") == "string" and not isinstance(tool_input[field], str):
            problems.append(field + " must be a string")

    return problems