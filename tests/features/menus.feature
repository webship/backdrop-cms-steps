@administration @menus
Feature: Menus and menu links
  As a tester of a site
  I want to add, disable, enable and delete the links of a menu
  So that the menus of the site are covered

  # Every scenario removes the link it creates.

  Background:
    Given I am logged in as "admin"

  @critical
  Scenario: The primary navigation has its links in the administration
    Then the "Primary navigation" menu should have the link "Home"
    And the "Primary navigation" menu should have the link "About"
    And the "Primary navigation" menu should have the link "Visit the apiary"
    And the "Primary navigation" menu should not have the link "No such link"

  Scenario: A link is added to the primary navigation and deleted
    Given the link "Hours from the suite" does not exist in the "Primary navigation" menu
    When I add the link "Hours from the suite" to "opening-hours" in the "Primary navigation" menu
    Then the "Primary navigation" menu should have the link "Hours from the suite"
    When I go to the homepage
    Then the primary navigation should list "Hours from the suite"
    When I click "Hours from the suite" in the primary navigation
    Then the page heading should be "Opening hours"
    When I delete the link "Hours from the suite" from the "Primary navigation" menu
    Then the "Primary navigation" menu should not have the link "Hours from the suite"
    When I go to the homepage
    Then the primary navigation should not list "Hours from the suite"

  Scenario: A disabled link stays in the menu but is not shown
    Given the link "Start from the suite" does not exist in the "Primary navigation" menu
    When I add the link "Start from the suite" to "<front>" in the "Primary navigation" menu
    And I disable the link "Start from the suite" of the "Primary navigation" menu
    Then the "Primary navigation" menu should have the link "Start from the suite"
    When I go to the homepage
    Then the primary navigation should not list "Start from the suite"
    When I enable the link "Start from the suite" of the "Primary navigation" menu
    And I go to the homepage
    Then the primary navigation should list "Start from the suite"
    When I delete the link "Start from the suite" from the "Primary navigation" menu
    Then the "Primary navigation" menu should not have the link "Start from the suite"

  Scenario: A link to a path that does not exist is refused
    When I go to the "menus" administration page
    And I choose the "Manage links" operation of the "Primary navigation" row
    And I follow the "Add link" action link
    And I enter "Broken from the suite" in the "Menu link title" field
    And I enter "no-such-path-anywhere" in the "Path" field
    And I press "Save"
    Then there should be an error message
    And the "Path" field should be marked as an error
    And the "Primary navigation" menu should not have the link "Broken from the suite"
