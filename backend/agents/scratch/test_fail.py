import tools

# make generate_report fail about half the time
tools.FAIL_RATE["generate_report"] = 0.5

failures = 0
for i in range(20):
    try:
        tools.generate_report()
    except tools.TransientToolError:
        failures = failures + 1

print("failed", failures, "out of 20")