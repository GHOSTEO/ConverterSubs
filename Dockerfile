FROM tindy2013/subconverter:latest

WORKDIR /subconverter

EXPOSE 25500

CMD ["sh", "-c", "./subconverter"]
