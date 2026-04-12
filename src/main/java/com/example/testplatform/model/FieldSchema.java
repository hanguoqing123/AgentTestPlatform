package com.example.testplatform.model;

public class FieldSchema {

    private String type;       // string, number, boolean, object, array
    private boolean required;
    private String description;
    private String example;

    public FieldSchema() {}

    public FieldSchema(String type, boolean required) {
        this.type = type;
        this.required = required;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public boolean isRequired() { return required; }
    public void setRequired(boolean required) { this.required = required; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getExample() { return example; }
    public void setExample(String example) { this.example = example; }
}
