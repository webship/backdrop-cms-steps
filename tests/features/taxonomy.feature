@content @taxonomy
Feature: Terms and tags
  As a tester of a site
  I want to add and delete terms and tag content
  So that the vocabularies of the site are covered

  Scenario: The editor adds a term to the tags and deletes it
    Given I am logged in as "editor"
    And the term "Wax" does not exist in the "Tags" vocabulary
    When I add the term "Wax" to the "Tags" vocabulary
    Then the status message should contain "Created new term Wax."
    And the "Tags" vocabulary should have the term "Wax"
    When I delete the term "Wax" from the "Tags" vocabulary
    Then the status message should contain "Deleted term Wax."
    And the "Tags" vocabulary should not have the term "Wax"

  @critical
  Scenario: The seeded terms are in the vocabulary
    Given I am logged in as "editor"
    Then the "Tags" vocabulary should have the term "Bees"
    And the "Tags" vocabulary should have the term "Honey"
    And the "Tags" vocabulary should have the term "Hives"
    And the "Tags" vocabulary should not have the term "No such term"

  Scenario: A post is tagged with a suggested term
    Given I am logged in as "editor"
    And the content "Tagged note from the suite" does not exist
    When I start a new "Post"
    And I enter "Tagged note from the suite" in the "Title" field
    And I type "Hon" into the "Tags" field and pick the suggestion "Honey"
    And I save the content form
    Then the content on the page should be tagged "Honey"
    And the content on the page should not be tagged "Bees"
    When I click "Honey"
    Then the page heading should be "Honey"
    And I should see the teaser "Tagged note from the suite"
    When I delete the content "Tagged note from the suite"
    Then the content "Tagged note from the suite" should not exist

  Scenario: A new tag typed on a post becomes a term
    Given I am logged in as "editor"
    And the content "Note with a new tag from the suite" does not exist
    And the term "Propolis" does not exist in the "Tags" vocabulary
    When I start a new "Post"
    And I enter "Note with a new tag from the suite" in the "Title" field
    And I fill in "Tags" with "Propolis"
    And I save the content form
    Then the content on the page should be tagged "Propolis"
    And the "Tags" vocabulary should have the term "Propolis"
    When I delete the content "Note with a new tag from the suite"
    And I delete the term "Propolis" from the "Tags" vocabulary
    Then the "Tags" vocabulary should not have the term "Propolis"
