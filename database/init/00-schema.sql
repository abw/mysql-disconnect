CREATE TABLE thing (
    id              SERIAL,
    name            VARCHAR(64)     NOT NULL,
    PRIMARY KEY     (id)
)
    ENGINE          = InnoDB
    DEFAULT CHARSET = utf8
    AUTO_INCREMENT  = 100
    COMMENT         = 'A thing'
;
