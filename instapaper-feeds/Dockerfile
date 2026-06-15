ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

# Install dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    go \
    git

# Install feeds-to-instapaper Go binary
ENV GOBIN=/usr/local/bin
RUN go install github.com/kupospelov/feeds-to-instapaper@latest

# Copy server files
COPY server /server
WORKDIR /server
RUN npm install

# Copy run script
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
