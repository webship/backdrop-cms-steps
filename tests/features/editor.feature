@content @editor
Feature: The rich text editor
  As a tester of a site
  I want to write in the rich text editor of a formatted text field, use its toolbar and read what it holds
  So that the body of a piece of content is covered

  Background:
    Given I am logged in as "editor"
    And I start a new "Post"

  @critical
  Scenario: HTML written in the editor is what the editor holds
    When I write "<p>Hello <strong>bees</strong></p>" in the "Body" editor
    Then the "Body" editor should contain "<p>Hello <strong>bees</strong></p>"
    And the "Body" editor should not contain "<em>"

  Scenario: Plain text becomes a paragraph
    When I write "A plain sentence." in the "Body" editor
    Then the "Body" editor should contain "<p>A plain sentence.</p>"

  Scenario: The toolbar has the buttons of the text format
    Then the "Body" editor should have the "Bold" button
    And the "Body" editor should have the "Italic" button
    And the "Body" editor should have the "Bulleted List" button
    And the "Body" editor should not have the "Underline" button

  Scenario: A toolbar button applies to the text typed after it
    When I press the "Bold" button of the "Body" editor
    And I type "bold words" into the "Body" editor
    Then the "Body" editor should contain "<strong>bold words</strong>"
    When I press the "Bold" button of the "Body" editor
    And I type " and plain ones" into the "Body" editor
    Then the "Body" editor should contain "<strong>bold words</strong> and plain ones"

  Scenario: The editor removes the tags its text format does not allow
    When I write "<p>Safe text</p><script>alert('x')</script>" in the "Body" editor
    Then the "Body" editor should contain "Safe text"
    And the "Body" editor should not contain "<script>"

  Scenario: What the editor holds is saved with the content
    Given the content "Formatted note from the suite" does not exist
    When I start a new "Post"
    And I enter "Formatted note from the suite" in the "Title" field
    And I write "<h3>Hours</h3><ul><li>Nine</li><li>Five</li></ul>" in the "Body" editor
    And I save the content form
    Then I should see 1 "article.node .field-name-body h3" elements
    And I should see 2 "article.node .field-name-body li" elements
    When I edit the content "Formatted note from the suite"
    Then the "Body" editor should contain "<h3>Hours</h3>"
    When I delete the content "Formatted note from the suite"
    Then the content "Formatted note from the suite" should not exist
