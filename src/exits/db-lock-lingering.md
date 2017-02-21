CODE:1001

Syncstuff is exiting.

It appears a database lock file exists. This either means another Syncstuff
process is running or that Syncstuff did not exit cleanly during its last
run.

We can try to fix this automatically if you run:

    syncstuff --repair-dbs
